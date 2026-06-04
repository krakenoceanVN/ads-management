export function normalizeDate(value: string | undefined | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const match = raw.match(/^(\d{2}|\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return raw;

  const year = match[1].length === 2 ? `20${match[1]}` : match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function matchesDateFilter(rowDate: string | undefined | null, selectedDate: string) {
  if (!selectedDate) return true;
  return normalizeDate(rowDate) === normalizeDate(selectedDate);
}

export function compareNormalizedDates(left: string | undefined | null, right: string | undefined | null) {
  return normalizeDate(left).localeCompare(normalizeDate(right));
}

export function sortRowsByDate<T extends Record<string, any>>(rows: T[], secondaryKeys: string[] = []) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const dateCompare = compareNormalizedDates(left.row.date, right.row.date);
      if (dateCompare !== 0) return dateCompare;

      for (const key of secondaryKeys) {
        const fieldCompare = String(left.row[key] ?? '').localeCompare(String(right.row[key] ?? ''));
        if (fieldCompare !== 0) return fieldCompare;
      }

      return left.index - right.index;
    })
    .map(item => item.row);
}
