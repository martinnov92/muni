import type {ComponentProps, ReactNode, Ref} from 'react';

interface DataTableProps {
  headers: readonly string[];
  labelledBy: string;
  children: ReactNode;
  empty: boolean;
  emptyMessage: string;
  scrollRef?: Ref<HTMLDivElement>;
  className?: string;
  minWidth?: 'wide' | 'compact';
  scrollable?: boolean;
}

export function DataTable({
  headers,
  labelledBy,
  children,
  empty,
  emptyMessage,
  scrollRef,
  className = '',
  minWidth = 'wide',
  scrollable = true,
}: DataTableProps) {
  const widthClass = minWidth === 'compact' ? 'min-w-lg' : 'min-w-2xl';
  const scrollClass = scrollable ? 'max-h-80 overflow-auto sm:max-h-96' : '';

  return (
    <div
      ref={scrollRef}
      className={`${scrollClass} ${className}`.trim()}
      role={scrollable ? 'region' : undefined}
      aria-labelledby={scrollable ? labelledBy : undefined}
      tabIndex={scrollable ? 0 : undefined}
    >
      <table className={`w-full ${widthClass} text-left text-sm`} aria-labelledby={labelledBy}>
        <thead className={scrollable ? 'sticky top-0 z-10 bg-canvas' : 'bg-canvas'}>
        <tr className='border-b border-line'>
          {headers.map((header) => (
            <th
              key={header}
              scope='col'
              className='px-3 py-2 font-normal whitespace-nowrap text-muted first:pl-0 last:pr-0'
            >
              {header}
            </th>
          ))}
        </tr>
        </thead>
        <tbody>
        {empty ? (
          <tr>
            <td colSpan={headers.length} className='py-6 text-muted'>{emptyMessage}</td>
          </tr>
        ) : children}
        </tbody>
      </table>
    </div>
  );
}

type TableCellProps = ComponentProps<'td'> & { header?: boolean };

export function TableCell({header = false, className = '', ...props}: TableCellProps) {
  const classes = `px-3 py-2 align-top first:pl-0 last:pr-0 ${header ? 'font-normal' : ''} ${className}`.trim();

  if (header) {
    return <th scope='row' className={classes} {...props} />;
  }

  return <td className={classes} {...props} />;
}
