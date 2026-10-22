import Papa from 'papaparse';
import chardet from 'chardet';
import type {CsvDocument, CsvRow, DataIssue, DecodedCsv} from './types';

export function decodeCsv(bytes: Uint8Array): DecodedCsv {
  try {
    const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);

    return {
      text,
      encoding: 'utf-8',
      usedFallback: false,
    };
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    const detected = chardet.detect(bytes);
    const encoding = detected?.toLowerCase();

    if (
      encoding !== 'utf-8' &&
      encoding !== 'utf-16le' &&
      encoding !== 'utf-16be' &&
      encoding !== 'windows-1250'
    ) {
      throw new RangeError(
        `Unsupported encoding: ${detected ?? 'unknown'}`,
      );
    }

    const text = new TextDecoder(encoding, {fatal: true}).decode(bytes);

    return {
      text,
      encoding,
      usedFallback: encoding === 'windows-1250',
    };
  }
}

export function parseCsv(bytes: Uint8Array): CsvDocument {
  const decoded = decodeCsv(bytes);

  const parsed = Papa.parse<string[]>(decoded.text, {
    header: false,
    delimiter: '',
    dynamicTyping: false,
    skipEmptyLines: true,
    delimitersToGuess: [',', ';', '\t', '|'],
  });

  const delimiter = parsed.meta.delimiter;

  if (
    delimiter !== ',' &&
    delimiter !== ';' &&
    delimiter !== '\t' &&
    delimiter !== '|'
  ) {
    throw new RangeError('Unsupported delimiter.');
  }

  const rows: CsvRow[] = [];
  const issues: DataIssue[] = [];
  const headers = parsed.data[0] ?? [];

  if (decoded.usedFallback) {
    issues.push({
      code: 'FALLBACK_ENCODING',
      severity: 'warning',
    });
  }

  const duplicateHeaders = new Set(headers).size !== headers.length;

  if (duplicateHeaders) {
    issues.push({
      code: 'DUPLICATE_HEADER',
      severity: 'error',
      row: 1,
    });
  }

  if (parsed.errors.length > 0) {
    issues.push({
      code: 'CSV_STRUCTURE',
      severity: 'error',
    });
  }

  if (!duplicateHeaders && parsed.errors.length === 0) {
    parsed.data.slice(1).forEach((values, index) => {
      if (values.length !== headers.length) {
        issues.push({
          code: 'CSV_STRUCTURE',
          severity: 'error',
          row: index + 2,
        });

        return;
      }

      const row = Object.fromEntries(headers.map((header, column) => [header, values[column]]));

      rows.push(row);
    });
  }

  return {
    rows,
    issues,
    headers,
    delimiter,
    encoding: decoded.encoding,
  };
}
