import {useRef, useState} from 'react';
import {DataTable, TableCell} from '@/components/data-table';
import {Pagination} from '@/components/pagination';
import type {DashboardData} from '@/lib/training/dashboard';
import type {TrainingEvaluation} from '@/lib/training/types';
import {EmployeeTrainingDetails} from './employee-training-details';
import {employeeName} from './format';

const pageSize = 50;

function trainingSummary(evaluations: readonly TrainingEvaluation[]): string {
  if (evaluations.length === 0) {
    return 'Bez evidovaných školení';
  }

  if (evaluations.every((evaluation) => evaluation.state === 'inactive')) {
    return 'Neaktivní zaměstnanec';
  }

  const urgent = evaluations.filter((evaluation) => ['expired', 'missing'].includes(evaluation.state)).length;
  const expiring = evaluations.filter((evaluation) => evaluation.state === 'expiring').length;
  const unknown = evaluations.filter((evaluation) => evaluation.state === 'unknown').length;
  const parts: string[] = [];

  if (urgent > 0) {
    parts.push(`Chybí nebo po platnosti: ${urgent}`);
  }

  if (expiring > 0) {
    parts.push(`Brzy končí: ${expiring}`);
  }

  if (unknown > 0) {
    parts.push(`Ověřit: ${unknown}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Bez upozornění';
}

export function EmployeeTrainingTable({data}: { data: DashboardData }) {
  const [page, setPage] = useState(1);
  const overviewRef = useRef<HTMLDivElement>(null);
  const visibleEmployees = data.employees.slice((page - 1) * pageSize, page * pageSize);

  function changePage(nextPage: number) {
    setPage(nextPage);
    overviewRef.current?.scrollTo({top: 0});
  }

  return (
    <section id='prehled' aria-labelledby='zamestnanci-nadpis' className='mt-8'>
      <h2 id='zamestnanci-nadpis' className='text-base font-semibold'>Zaměstnanci a školení</h2>
      <p role='status' className='mt-4 mb-2 text-sm text-muted'>
        Celkem {data.employees.length} zaměstnanců. Školení zobrazíte rozbalením řádku.
      </p>

      <DataTable
        headers={['Zaměstnanec / útvar']}
        labelledBy='zamestnanci-nadpis'
        scrollRef={overviewRef}
        empty={visibleEmployees.length === 0}
        emptyMessage='Žádní evidovaní zaměstnanci.'
      >
        {visibleEmployees.map((employee) => {
          const evaluations = data.evaluations.filter((evaluation) => evaluation.employeeId === employee.id);
          const labelId = `employee-${encodeURIComponent(employee.id)}`;

          return (
            <tr key={employee.id} className='border-b border-line'>
              <TableCell>
                <details>
                  <summary className='cursor-pointer'>
                    <span id={labelId}>{employeeName(employee, employee.id)}</span>
                    <span className='ml-2 text-xs text-muted'>
                      {employee.id} · {employee.unit ?? 'Útvar neuveden'}
                    </span>
                    <span className='mt-1 block text-xs'>{trainingSummary(evaluations)}</span>
                  </summary>
                  <EmployeeTrainingDetails data={data} evaluations={evaluations} labelledBy={labelId}/>
                </details>
              </TableCell>
            </tr>
          );
        })}
      </DataTable>
      <Pagination
        page={page}
        total={data.employees.length}
        pageSize={pageSize}
        onChange={changePage}
        label='Stránkování zaměstnanců a školení'
      />
    </section>
  );
}
