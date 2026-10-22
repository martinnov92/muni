import {useRef, useState} from 'react';
import {DataTable, TableCell} from '@/components/data-table';
import {Pagination} from '@/components/pagination';
import type {DashboardData} from '@/lib/training/dashboard';
import type {IssueCode} from '@/lib/training/types';

const pageSize = 50;

const issueLabels: Record<IssueCode, string> = {
  FALLBACK_ENCODING: 'Rozpoznáno kódování Windows-1250; jde o odhad.',
  CSV_STRUCTURE: 'Nesprávná struktura CSV.',
  DUPLICATE_HEADER: 'Opakovaný název sloupce.',
  MISSING_COLUMN: 'Chybí očekávaný sloupec.',
  METADATA_ROW: 'Vynechán řádek s metadaty exportu.',
  DUPLICATE_RECORD: 'Vynechán duplicitní záznam.',
  UNKNOWN_EMPLOYEE: 'Odkaz na neznámého zaměstnance.',
  UNKNOWN_TRAINING: 'Odkaz na neznámé školení.',
  INVALID_DATE: 'Neplatné nebo chybějící datum.',
  SUSPICIOUS_DATE: 'Podezřelé datum - vyžaduje kontrolu.',
  MISSING_UNIT: 'Chybí útvar zaměstnance.',
  UNKNOWN_REQUIREMENT: 'Nelze určit, komu je školení povinné.',
  UNKNOWN_VALIDITY: 'Nelze určit délku platnosti školení.',
  ASSUMED_UNLIMITED_VALIDITY: 'Nulová délka platnosti je vyložena jako neomezená.',
  INVALID_COMPLETION: 'Neplatný záznam o absolvování školení.',
  FUTURE_COMPLETION: 'Absolvování je uvedeno až po datu exportu.',
  INFERRED_EXPIRY: 'Platnost dopočítána podle katalogu školení.',
  INVALID_CAPACITY: 'Neplatná kapacita nebo obsazenost termínu.',
};

const severityLabels = {
  info: 'Informace',
  warning: 'Upozornění',
  error: 'Chyba',
};

export function DataIssuesTable({issues}: {issues: DashboardData['issues']}) {
  const [page, setPage] = useState(1);
  const issuesRef = useRef<HTMLDivElement>(null);
  const visibleIssues = issues.slice((page - 1) * pageSize, page * pageSize);

  function changePage(nextPage: number) {
    setPage(nextPage);
    issuesRef.current?.scrollTo({top: 0});
  }

  return (
    <section id='problemy' aria-labelledby='problemy-nadpis' className='mt-10'>
      <h2 id='problemy-nadpis' className='text-base font-semibold'>Problémy v datech</h2>
      {issues.length === 0 ? <p className='mt-2 text-sm text-muted'>Bez nalezených problémů.</p> : (
        <details className='mt-2'>
          <summary className='cursor-pointer text-sm'>Zobrazit upozornění a chyby ({issues.length})</summary>
          <p className='mt-3 text-xs text-muted'>
            Číslo záznamu zahrnuje hlavičku CSV. U víceřádkových buněk se nemusí shodovat s číslem řádku v editoru.
          </p>
          <DataTable
            headers={['Soubor', 'Záznam / sloupec', 'Problém']}
            labelledBy='problemy-nadpis'
            scrollRef={issuesRef}
            className='mt-3'
            minWidth='compact'
            empty={visibleIssues.length === 0}
            emptyMessage='Bez nalezených problémů.'
          >
            {visibleIssues.map((issue, index) => (
              <tr key={(page - 1) * pageSize + index} className='border-b border-line'>
                <TableCell>{issue.source}</TableCell>
                <TableCell>{issue.row ?? '—'}{issue.field ? ` / ${issue.field}` : ''}</TableCell>
                <TableCell>
                  <span className='block text-xs text-muted'>{severityLabels[issue.severity]}</span>
                  {issueLabels[issue.code]}
                </TableCell>
              </tr>
            ))}
          </DataTable>
          <Pagination
            page={page}
            total={issues.length}
            pageSize={pageSize}
            onChange={changePage}
            label='Stránkování problémů v datech'
          />
        </details>
      )}
    </section>
  );
}
