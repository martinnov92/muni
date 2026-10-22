import type {Employee} from '@/lib/training/types';

export function formatDate(value: string | null): string {
  if (value === null) {
    return '—';
  }

  const [year, month, day] = value.split('-');
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

export function employeeName(employee: Employee | undefined, fallback: string): string {
  return employee ? `${employee.familyName} ${employee.givenName}` : fallback;
}
