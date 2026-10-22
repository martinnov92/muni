import {DataTable, TableCell} from '@/components/data-table';
import type {DashboardData} from '@/lib/training/dashboard';
import type {TrainingEvaluation, TrainingState} from '@/lib/training/types';
import {formatDate} from './format';

const stateLabels: Record<TrainingState, string> = {
  valid: 'Platné',
  expiring: 'Brzy končí',
  expired: 'Po platnosti',
  missing: 'Chybí',
  unknown: 'Nelze určit',
  'not-required': 'Nepovinné',
  inactive: 'Neaktivní zaměstnanec',
};

export function EmployeeTrainingDetails({data, evaluations, labelledBy}: {
  data: DashboardData;
  evaluations: readonly TrainingEvaluation[];
  labelledBy: string;
}) {
  const trainings = new Map(data.trainings.map((training) => [training.code, training]));
  const trainingSessions = new Map(data.trainingSessions.map((session) => [session.id, session]));
  const assignments = new Map(data.plan.assignments.map((assignment) => [
    JSON.stringify([assignment.employeeId, assignment.trainingCode]), assignment,
  ]));
  const unresolved = new Map(data.plan.unresolved.map((need) => [need.requirementId, need.reason]));

  return (
    <DataTable
      headers={['Školení', 'Platnost do', 'Stav', 'Doporučený termín']}
      labelledBy={labelledBy}
      scrollable={false}
      className='mt-3'
      empty={evaluations.length === 0}
      emptyMessage='Žádná evidovaná školení.'
    >
      {evaluations.map((evaluation) => {
        const key = JSON.stringify([evaluation.employeeId, evaluation.trainingCode]);
        const assignment = assignments.get(key);
        const trainingSession = assignment ? trainingSessions.get(assignment.trainingSessionId) : undefined;
        const unresolvedReason = unresolved.get(`${evaluation.employeeId}:${evaluation.trainingCode}`);
        const late = trainingSession?.date && evaluation.validUntil && trainingSession.date > evaluation.validUntil;

        return (
          <tr key={key} className='border-b border-line'>
            <TableCell header>{trainings.get(evaluation.trainingCode)?.name ?? evaluation.trainingCode}</TableCell>
            <TableCell className='whitespace-nowrap'>
              {evaluation.validUntil ? formatDate(evaluation.validUntil) : evaluation.state === 'valid' ? 'Bez omezení' : '—'}
            </TableCell>
            <TableCell className={['expired', 'missing', 'unknown'].includes(evaluation.state) ? 'font-semibold' : ''}>
              {stateLabels[evaluation.state]}
            </TableCell>
            <TableCell>
              {trainingSession ? (
                <>
                  <a href={`#termin-${encodeURIComponent(trainingSession.id)}`} className='underline underline-offset-2'>
                    {formatDate(trainingSession.date)} {trainingSession.time}
                  </a>
                  {late && <span className='mt-1 block text-xs font-semibold'>Až po konci platnosti</span>}
                </>
              ) : unresolvedReason === 'no-session' ? 'Není vhodný termín'
                : unresolvedReason === 'no-capacity' ? 'Chybí kapacita'
                  : evaluation.state === 'unknown' ? 'Ověřit data' : '—'}
            </TableCell>
          </tr>
        );
      })}
    </DataTable>
  );
}
