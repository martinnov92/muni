interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  label: string;
}

const buttonClass = 'rounded border border-line px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40';

export function Pagination({page, total, pageSize, onChange, label}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (pages === 1) {
    return null;
  }

  return (
    <nav aria-label={label} className='mt-4 flex flex-wrap items-center gap-3 text-sm'>
      <button type='button' className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Předchozí
      </button>
      <span aria-live='polite'>Strana {page} z {pages}</span>
      <button type='button' className={buttonClass} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Další
      </button>
    </nav>
  );
}
