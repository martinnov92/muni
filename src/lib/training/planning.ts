import type {ISODate, RecommendationPlan, TrainingSession, TrainingNeed} from './types';

export function recommendAssignments(
  needs: readonly TrainingNeed[],
  trainingSessions: readonly TrainingSession[],
  asOf: ISODate,
): RecommendationPlan {
  const plan: RecommendationPlan = {assignments: [], unresolved: []};
  const urgency = {expired: 0, missing: 1, expiring: 2};
  const orderedNeeds = [...needs].sort((left, right) =>
    urgency[left.state] - urgency[right.state] ||
    (left.deadline ?? '9999-12-31').localeCompare(right.deadline ?? '9999-12-31') ||
    left.id.localeCompare(right.id),
  );

  const availableTrainingSessions = trainingSessions.flatMap((trainingSession) => {
    if (
      trainingSession.status !== 'scheduled' ||
      trainingSession.date === null ||
      trainingSession.date < asOf ||
      trainingSession.capacity === null ||
      trainingSession.occupied === null
    ) {
      return [];
    }

    return [{
      id: trainingSession.id,
      trainingCode: trainingSession.trainingCode,
      date: trainingSession.date,
      remaining: Math.max(0, trainingSession.capacity - trainingSession.occupied),
    }];
  }).sort((left, right) =>
    left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );

  const handledNeeds = new Set<string>();

  for (const need of orderedNeeds) {
    if (handledNeeds.has(need.id)) {
      continue;
    }

    handledNeeds.add(need.id);

    const suitable = availableTrainingSessions.filter((trainingSession) =>
      trainingSession.trainingCode === need.trainingCode &&
      (need.employmentEnd === null || trainingSession.date <= need.employmentEnd),
    );
    const selected = suitable.find((trainingSession) => trainingSession.remaining > 0);

    if (selected === undefined) {
      plan.unresolved.push({
        requirementId: need.id,
        reason: suitable.length === 0 ? 'no-session' : 'no-capacity',
      });
      continue;
    }

    plan.assignments.push({
      requirementId: need.id,
      employeeId: need.employeeId,
      trainingCode: need.trainingCode,
      trainingSessionId: selected.id,
    });
    selected.remaining -= 1;
  }

  return plan;
}
