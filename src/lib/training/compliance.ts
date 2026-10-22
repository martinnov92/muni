import type {
  Completion,
  Employee,
  EvaluationOptions,
  ISODate,
  TrainingDefinition,
  TrainingEvaluation,
} from './types';

export function employmentState(
  employee: Employee,
  asOf: ISODate,
): 'active' | 'inactive' | 'unknown' {
  // Parental leave is excluded in MVP
  if (employee.status === 'ended' || employee.status === 'parental-leave') {
    return 'inactive';
  }

  if (
    (employee.startDate !== null && employee.startDate > asOf) ||
    (employee.endDate !== null && employee.endDate < asOf)
  ) {
    return 'inactive';
  }

  if (employee.status === 'unknown' || employee.startDate === null) {
    return 'unknown';
  }

  return 'active';
}

export function requirementFor(
  employee: Employee,
  training: TrainingDefinition,
): 'required' | 'not-required' | 'unknown' {
  const rule = training.requirement;

  switch (rule.kind) {
    case 'all':
      return 'required';
    case 'optional':
      return 'not-required';
    case 'units':
      return employee.unit === null
        ? 'unknown'
        : rule.units.includes(employee.unit) ? 'required' : 'not-required';
    case 'positions':
      return employee.position === null
        ? 'unknown'
        : rule.positions.includes(employee.position) ? 'required' : 'not-required';
    case 'unknown':
      return 'unknown';
  }
}

export function evaluateTraining(
  employee: Employee,
  training: TrainingDefinition,
  completions: readonly Completion[],
  options: EvaluationOptions,
): TrainingEvaluation {
  const result: TrainingEvaluation = {
    employeeId: employee.id,
    trainingCode: training.code,
    state: 'unknown',
    validUntil: null,
    completionId: null,
  };

  const employment = employmentState(employee, options.asOf);
  if (employment !== 'active') {
    return {...result, state: employment};
  }

  const requirement = requirementFor(employee, training);
  if (requirement !== 'required') {
    return {...result, state: requirement};
  }

  if (training.validity.kind === 'unknown') {
    return result;
  }

  const matching = completions.filter((record) =>
    record.employeeId === employee.id && record.trainingCode === training.code,
  );

  if (matching.length === 0) {
    return {...result, state: 'missing'};
  }

  // Bad evidence requires review even alongside a valid certificate.
  if (matching.some((record) =>
    record.quality === 'invalid' ||
    record.completedOn === null ||
    record.completedOn > options.asOf,
  )) {
    return result;
  }

  matching.sort((left, right) => {
    const dateOrder = (right.completedOn ?? '').localeCompare(left.completedOn ?? '');
    return dateOrder || left.id.localeCompare(right.id);
  });

  const latest = matching[0];

  result.completionId = latest.id;
  result.validUntil = latest.validUntil;

  if (training.validity.kind === 'unlimited' && latest.validUntil === null) {
    return {...result, state: 'valid'};
  }

  if (latest.validUntil === null) {
    return result;
  }

  if (latest.validUntil < options.asOf) {
    return {...result, state: 'expired'};
  }

  const warningEnd = new Date(`${options.asOf}T00:00:00Z`);
  warningEnd.setUTCDate(warningEnd.getUTCDate() + options.expiringWithinDays);

  return {
    ...result,
    state: latest.validUntil <= warningEnd.toISOString().slice(0, 10)
      ? 'expiring'
      : 'valid',
  };
}
