'use client';

import type {DashboardData} from '@/lib/training/dashboard';
import {DataIssuesTable} from './dashboard/data-issues-table';
import {EmployeeTrainingTable} from './dashboard/employee-training-table';
import {formatDate} from './dashboard/format';
import {TrainingSessionsTable} from './dashboard/training-sessions-table';

export default function TrainingDashboard({data}: { data: DashboardData }) {
  const urgentCount = data.evaluations.filter((evaluation) => ['expired', 'missing'].includes(evaluation.state)).length;
  const expiringCount = data.evaluations.filter((evaluation) => evaluation.state === 'expiring').length;
  const unknownCount = data.evaluations.filter((evaluation) => evaluation.state === 'unknown').length;

  return (
    <main id='hlavni-obsah' tabIndex={-1} className='mx-auto max-w-4xl px-5 py-8 sm:px-8'>
      <p className='text-sm text-muted'>
        Stav k {formatDate(data.asOf)} podle exportu. Data jsou fiktivní.
      </p>
      <dl className='mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm'>
        {[
          ['Zaměstnanců', data.employees.length],
          ['Chybí nebo po platnosti', urgentCount],
          ['Brzy končí', expiringCount],
          ['Nelze určit', unknownCount],
        ].map(([label, count]) => (
          <div key={label} className='flex gap-2'>
            <dt className='text-muted'>{label}:</dt>
            <dd className='font-semibold'>{count}</dd>
          </div>
        ))}
      </dl>
      <p className='mt-2 text-xs text-muted'>
        Počty stavů představují jednotlivé povinnosti zaměstnanců. Brzy končí = platnost končí do 30 dnů včetně.
      </p>

      <EmployeeTrainingTable data={data}/>
      <TrainingSessionsTable data={data}/>
      <DataIssuesTable issues={data.issues}/>
    </main>
  );
}
