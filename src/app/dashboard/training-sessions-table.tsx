import {DataTable, TableCell} from '@/components/data-table';
import type {DashboardData} from '@/lib/training/dashboard';
import {employeeName, formatDate} from './format';

export function TrainingSessionsTable({data}: { data: DashboardData }) {
  const employees = new Map(data.employees.map((employee) => [employee.id, employee]));
  const trainings = new Map(data.trainings.map((training) => [training.code, training]));
  const evaluations = new Map(data.evaluations.map((evaluation) => [
    JSON.stringify([evaluation.employeeId, evaluation.trainingCode]), evaluation,
  ]));
  const sortedTrainingSessions = [...data.trainingSessions].sort((left, right) =>
    (left.date ?? '9999').localeCompare(right.date ?? '9999') || left.time.localeCompare(right.time),
  );

  return (
    <section id='terminy' aria-labelledby='terminy-nadpis' className='mt-10'>
      <h2 id='terminy-nadpis' className='text-base font-semibold'>Termíny školení a doporučení</h2>
      <p className='mt-2 text-sm text-muted'>
        Doporučeno {data.plan.assignments.length} přihlášení. Bez vhodného termínu nebo volné
        kapacity: {data.plan.unresolved.length}.
      </p>
      <DataTable
        headers={['Školení', 'Datum a místo', 'Kapacita', 'Doporučení']}
        labelledBy='terminy-nadpis'
        className='mt-3'
        empty={sortedTrainingSessions.length === 0}
        emptyMessage='Žádné načtené termíny.'
      >
        {sortedTrainingSessions.map((trainingSession) => {
          const recommended = data.plan.assignments.filter((assignment) => assignment.trainingSessionId === trainingSession.id);
          const available = trainingSession.status === 'scheduled' && trainingSession.date !== null && trainingSession.date >= data.asOf
          && trainingSession.capacity !== null && trainingSession.occupied !== null
          && trainingSession.capacity >= trainingSession.occupied && trainingSession.occupied >= 0
            ? trainingSession.capacity - trainingSession.occupied : null;
          const status = trainingSession.status === 'cancelled' ? 'Zrušeno' : trainingSession.status === 'invalid'
            ? 'Neplatný termín' : trainingSession.date && trainingSession.date < data.asOf ? 'Minulý termín' : null;

          return (
            <tr id={`termin-${trainingSession.id}`} key={trainingSession.id}
                className='scroll-mt-10 border-b border-line'>
              <TableCell header>
                {trainings.get(trainingSession.trainingCode)?.name ?? trainingSession.trainingCode}
                <span className='mt-1 block text-xs text-muted'>{trainingSession.id}</span>
              </TableCell>
              <TableCell>
                <span className='whitespace-nowrap'>{formatDate(trainingSession.date)} {trainingSession.time}</span>
                <span className='mt-1 block text-xs text-muted'>{trainingSession.location || 'Místo neuvedeno'}</span>
                {status && <span className='mt-1 block text-xs font-semibold'>{status}</span>}
              </TableCell>
              <TableCell>
                {available === null ? 'Nelze použít' : (
                  <>
                    <span
                      className='whitespace-nowrap'>{trainingSession.occupied} / {trainingSession.capacity} obsazeno</span>
                    <span className='mt-1 block text-xs text-muted'>Volno: {available}</span>
                    {recommended.length > 0 && (
                      <span className='mt-1 block text-xs text-muted'>Po návrhu: {available - recommended.length}</span>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell>
                {recommended.length === 0 ? '—' : (
                  <details>
                    <summary className='cursor-pointer whitespace-nowrap'>Zaměstnanci: {recommended.length}</summary>
                    <ul className='mt-2 space-y-2'>
                      {recommended.map((assignment) => {
                        const evaluation = evaluations.get(JSON.stringify([assignment.employeeId, assignment.trainingCode]));
                        const late = trainingSession.date && evaluation?.validUntil && trainingSession.date > evaluation.validUntil;

                        return (
                          <li key={assignment.requirementId}>
                            {employeeName(employees.get(assignment.employeeId), assignment.employeeId)}
                            <span className='block text-xs text-muted'>
                              {assignment.employeeId}{late ? ' · Až po konci platnosti' : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </TableCell>
            </tr>
          );
        })}
      </DataTable>
    </section>
  );
}
