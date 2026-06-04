export type EntryType = 'CPM' | 'CPA' | 'CPS';

export interface AdvertiserEntryRow {
  id: number;
  date: string;
  advertiser: string;
  adOrder: string;
  type: EntryType;
  adId: string;
  rate: string;
  traffic: string;
  settlement: string;
  receivable: number | '';
  status?: 'pending' | 'confirmed';
}

export interface MediaEntryRow {
  id: number;
  date: string;
  media: string;
  mediaAdOrder: string;
  type: EntryType;
  mediaId: string;
  upstreamAdId: string;
  rate: string;
  traffic: string;
  settlement: string;
  dataCoefficient: string;
  receivable: number | '';
  shareRatio: string;
  actualReceived: number | '';
  status?: 'pending' | 'confirmed';
}

export type CalculatedAmount = number | '';

export function hasValue(val: unknown) {
  return val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—';
}

export function parseNumber(val: unknown) {
  if (typeof val === 'number') return val;
  if (!hasValue(val)) return 0;
  const s = String(val).replace(/,/g, '').replace(/%/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function parsePercent(val: unknown) {
  if (typeof val === 'number') return val > 1 ? val / 100 : val;
  if (!hasValue(val)) return 0;
  const s = String(val).replace(/,/g, '').trim();
  if (s.includes('%')) return parseNumber(s) / 100;
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

export function formatAmount(val: unknown) {
  if (!hasValue(val)) return '';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return Number.isInteger(n) ? n.toString() : Number(n.toFixed(3)).toString();
}

export function calculateAdvertiserReceivable(row: Pick<AdvertiserEntryRow, 'type' | 'rate' | 'settlement'>): CalculatedAmount {
  if (!hasValue(row.rate) || !hasValue(row.settlement)) return '';
  if (row.type === 'CPM') return parseNumber(row.rate) * parseNumber(row.settlement) / 1000;
  if (row.type === 'CPA') return parseNumber(row.rate) * parseNumber(row.settlement);
  if (row.type === 'CPS') return parseNumber(row.settlement) * parsePercent(row.rate);
  return '';
}

export function withAdvertiserCalculation(row: AdvertiserEntryRow): AdvertiserEntryRow {
  return { ...row, receivable: calculateAdvertiserReceivable(row) };
}

function normalizeId(id: string) {
  return String(id).trim();
}

export function findUpstreamAdvertiserRow(row: Pick<MediaEntryRow, 'upstreamAdId' | 'mediaId'>, upstreamRows: AdvertiserEntryRow[]) {
  const upstreamId = normalizeId(row.upstreamAdId || row.mediaId);
  return upstreamRows.find(item => normalizeId(item.adId) === upstreamId);
}

export function getMediaInheritedTraffic(row: MediaEntryRow, upstreamRows: AdvertiserEntryRow[]) {
  const upstream = findUpstreamAdvertiserRow(row, upstreamRows);
  return upstream?.traffic || row.traffic || '';
}

export function getMediaInheritedSettlement(row: MediaEntryRow, upstreamRows: AdvertiserEntryRow[]) {
  const upstream = findUpstreamAdvertiserRow(row, upstreamRows);
  if (!upstream) return row.settlement || '';
  if (row.type === 'CPM' || row.type === 'CPA') return upstream.settlement || row.settlement || '';
  const upstreamReceivable = calculateAdvertiserReceivable(upstream);
  return hasValue(upstreamReceivable) ? formatAmount(upstreamReceivable) : row.settlement || '';
}

export function withMediaInheritedValues(row: MediaEntryRow, upstreamRows: AdvertiserEntryRow[]): MediaEntryRow {
  return {
    ...row,
    traffic: getMediaInheritedTraffic(row, upstreamRows),
    settlement: getMediaInheritedSettlement(row, upstreamRows),
  };
}

export function calculateMediaReceivable(row: MediaEntryRow, upstreamRows: AdvertiserEntryRow[] = []): CalculatedAmount {
  const resolved = upstreamRows.length ? withMediaInheritedValues(row, upstreamRows) : row;
  if (!hasValue(resolved.dataCoefficient) || !hasValue(resolved.settlement)) return '';
  if (resolved.type === 'CPM') {
    if (!hasValue(resolved.rate)) return '';
    return parseNumber(resolved.rate) * parseNumber(resolved.settlement) * parsePercent(resolved.dataCoefficient) / 1000;
  }
  if (resolved.type === 'CPA') {
    if (!hasValue(resolved.rate)) return '';
    return parseNumber(resolved.rate) * parseNumber(resolved.settlement) * parsePercent(resolved.dataCoefficient);
  }
  if (resolved.type === 'CPS') return parseNumber(resolved.settlement) * parsePercent(resolved.dataCoefficient);
  return '';
}

export function calculateMediaActualReceived(row: MediaEntryRow, receivable: CalculatedAmount): CalculatedAmount {
  if (!hasValue(receivable) || !hasValue(row.shareRatio)) return '';
  return parseNumber(receivable) * parsePercent(row.shareRatio);
}

export function withMediaCalculation(row: MediaEntryRow, upstreamRows: AdvertiserEntryRow[]): MediaEntryRow {
  const resolved = { ...withMediaInheritedValues(row, upstreamRows), traffic: row.traffic };
  const receivable = calculateMediaReceivable(resolved);
  return {
    ...resolved,
    receivable,
    actualReceived: calculateMediaActualReceived(resolved, receivable),
  };
}
