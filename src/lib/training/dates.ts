import type {ISODate} from './types';

function fromDateParts(year: number, month: number, day: number): ISODate | null {
  if (year < 1 || year > 9999) {
    return null;
  }

  const date = new Date(0);

  // Use UTC consistently so the host time zone cannot shift the calendar date.
  date.setUTCFullYear(year, month - 1, day);

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function parseDate(value: string): ISODate | null {
  const text = value.trim();

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (isoDate) {
    return fromDateParts(
      Number(isoDate[1]),
      Number(isoDate[2]),
      Number(isoDate[3]),
    );
  }

  const czechDate = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(text);

  if (czechDate) {
    return fromDateParts(
      Number(czechDate[3]),
      Number(czechDate[2]),
      Number(czechDate[1]),
    );
  }

  if (/^\d+$/.test(text)) {
    const serial = Number(text);

    // Excel serial 60 represents the nonexistent date 1900-02-29.
    if (!Number.isSafeInteger(serial) || serial < 1 || serial === 60) {
      return null;
    }

    // Subtract Excel's fictitious leap day from later dates.
    // https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/excel/wrongly-assumes-1900-is-leap-year
    // absolvovana_skoleni.csv, example (43552, row 476)
    const days = serial > 60 ? serial - 1 : serial;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(
      Date.UTC(1899, 11, 31) + days * millisecondsPerDay,
    );

    return fromDateParts(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }

  return null;
}

export function addCalendarMonths(value: ISODate, months: number): ISODate {
  if (parseDate(value) !== value || !Number.isSafeInteger(months)) {
    throw new RangeError(
      'Expected a valid ISO date and an integer month offset.',
    );
  }

  const date = new Date(`${value}T00:00:00Z`);
  const originalDay = date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);

  const endOfMonth = new Date(date.getTime());
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);

  const targetDay = Math.min(originalDay, endOfMonth.getUTCDate());
  const result = fromDateParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    targetDay,
  );

  if (result === null) {
    throw new RangeError(
      'The resulting date is outside the supported year range.',
    );
  }

  return result;
}
