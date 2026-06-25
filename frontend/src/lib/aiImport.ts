/**
 * AI Data Input Assistant - deterministic paste import (Phase 1).
 *
 * The AI assistant is a SAFE review tool:
 *  - It only parses pasted CSV/tab-separated text into preview rows.
 *  - It never writes to the database. It never auto-saves or auto-confirms.
 *  - It never overrides server-side financial calculations.
 *  - It surfaces row-level status flags so the user can correct issues.
 *  - It supports advertiserEntry, mediaEntry, and yiyiDaily scopes.
 *
 * Phase 1 is fully deterministic. No LLM call. No backend endpoint.
 */

import type { AdTypeCode, EntryType } from './bffTypes';

// Limits to keep the UI responsive and avoid runaway parsing.
export const AI_IMPORT_LIMITS = {
  maxRawContentChars: 200_000,
  maxRows: 2_000,
  parseTimeoutMs: 1_500,
};

export type AiTargetScope = 'advertiserEntry' | 'mediaEntry' | 'yiyiDaily';

export type AiRowStatus =
  | 'matched'
  | 'ambiguous'
  | 'missingRequiredField'
  | 'invalidNumber'
  | 'confirmedConflict'
  | 'rateMismatch'
  | 'invalid';

export type AiFieldKey =
  | 'adIdSlot'
  | 'rate'
  | 'traffic'
  | 'settlement'
  | 'dataCoefficient'
  | 'yiyiChannel'
  | 'yiyiQty';

export interface AiPreviewField {
  key: AiFieldKey;
  label: string;
  value: string;
  numericValue: number | null;
  valid: boolean;
  message?: string;
}

export interface AiPreviewRow {
  id: string;
  status: AiRowStatus;
  flags: AiRowStatus[];
  fields: Record<string, AiPreviewField>;
  /** Resolved entity id (adIdNum for advertiser, upstreamAdIdNum for media). */
  resolvedEntityId: number | null;
  /** Display name of the resolved entity. */
  resolvedEntityLabel: string;
  /** True if the row has a confirmed-record conflict in the existing draft. */
  confirmedConflict: boolean;
  /** True if rate differs from server-side configured unit price. */
  rateMismatch: boolean;
  /** Source line for traceability. */
  source: string;
  /** True if the row has any errors that block applying. */
  blocking: boolean;
}

export interface AiParseSummary {
  total: number;
  valid: number;
  needsReview: number;
  rejected: number;
  notes: string[];
}

export interface AiParseResult {
  rows: AiPreviewRow[];
  summary: AiParseSummary;
  /** Resolved column mapping (header text → field key). */
  columnMap: Record<string, AiFieldKey | 'ignored' | 'date' | 'type'>;
  /** Trimmed raw content (so callers can show context). */
  rawSize: number;
  /** All detected column headers, for debug. */
  detectedHeaders: string[];
}

export interface AiParseOptions {
  scope: AiTargetScope;
  /** Existing entity rows keyed by stable string id (adIdNum, upstreamAdIdNum, channel). */
  existingEntities: Array<{ id: number | string; label: string; rate?: number | null; status?: string; type?: string }>;
  /** Date for the import (advertiser/media is single-date; yiyi is single-date as well). */
  date: string;
  /** adTypeCode used to filter entities and disambiguate names. */
  adTypeCode?: AdTypeCode;
  /** Optional raw adTypeCode from a row, used to detect rateMismatch per row. */
  detectRateMismatch?: (row: AiPreviewRow) => boolean;
}

// ---------------------------------------------------------------------------
// CSV / TSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse CSV/TSV text into a 2-D string grid using a tiny state machine.
 * Supports quoted fields, escaped quotes (""), and CR/LF inside quotes.
 * Detects the separator automatically from the first non-empty line.
 */
export function parseDelimited(input: string): { grid: string[][]; separator: ',' | '\t' | ';' } {
  const trimmed = input.replace(/\r\n?/g, '\n');
  if (!trimmed.trim()) return { grid: [], separator: ',' };

  const firstLine = trimmed.split('\n', 1)[0] ?? '';
  let separator: ',' | '\t' | ';' = ',';
  if (firstLine.includes('\t')) separator = '\t';
  else if (firstLine.includes(',') && firstLine.split(',').length >= 2) separator = ',';
  else if (firstLine.includes(';') && firstLine.split(';').length >= 2) separator = ';';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inQuotes) {
      if (ch === '"') {
        if (trimmed[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === separator) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  // Last cell
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop trailing empty rows
  while (rows.length && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  return { grid: rows, separator };
}

function isHeaderRow(cells: string[]): boolean {
  if (!cells.length) return false;
  let alpha = 0;
  let numeric = 0;
  for (const cell of cells) {
    const value = cell.trim();
    if (!value) continue;
    if (/^-?\d+(\.\d+)?$/.test(value.replace(/,/g, '').replace(/%/g, ''))) numeric++;
    else alpha++;
  }
  return alpha > 0 && alpha > numeric;
}

function normalizeHeader(text: string): string {
  return text
    .replace(/[\s_-]+/g, '')
    .replace(/[　]/g, '')
    .toLowerCase();
}

const HEADER_MAP: Record<string, AiFieldKey | 'date' | 'type' | 'ignored'> = {
  // Chinese
  日期: 'date',
  日期date: 'date',
  渠道: 'yiyiChannel',
  渠道channel: 'yiyiChannel',
  数量: 'yiyiQty',
  数量qty: 'yiyiQty',
  数量quantity: 'yiyiQty',
  流量: 'traffic',
  流量数据: 'traffic',
  流量traffic: 'traffic',
  流量数据traffic: 'traffic',
  结算: 'settlement',
  结算金额: 'settlement',
  结算金额settlement: 'settlement',
  广告主金额: 'settlement',
  广告主金额advertiseramount: 'settlement',
  单价: 'rate',
  单价比例: 'rate',
  单价分成比例: 'rate',
  分成比例: 'rate',
  比例: 'rate',
  广告id: 'adIdSlot',
  广告位: 'adIdSlot',
  广告位slot: 'adIdSlot',
  slot: 'adIdSlot',
  adidnum: 'adIdSlot',
  类型: 'type',
  计费类型: 'type',
  媒体id: 'adIdSlot',
  媒体idslot: 'adIdSlot',
  数据系数: 'dataCoefficient',
  数据系数coeff: 'dataCoefficient',
  coefficient: 'dataCoefficient',
  // English
  date: 'date',
  channel: 'yiyiChannel',
  qty: 'yiyiQty',
  quantity: 'yiyiQty',
  traffic: 'traffic',
  trafficdata: 'traffic',
  settlement: 'settlement',
  settlementamount: 'settlement',
  advertiseramount: 'settlement',
  rate: 'rate',
  unitprice: 'rate',
  unitpricerevenueshare: 'rate',
  revenueshare: 'rate',
  ratio: 'rate',
  adid: 'adIdSlot',
  adslot: 'adIdSlot',
  type: 'type',
  billingmethod: 'type',
  mediaid: 'adIdSlot',
  datacoefficient: 'dataCoefficient',
};

function mapHeader(header: string): AiFieldKey | 'date' | 'type' | 'ignored' {
  const normalized = normalizeHeader(header);
  return HEADER_MAP[normalized] ?? 'ignored';
}

function parseNumber(value: string): { num: number | null; valid: boolean; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { num: null, valid: false, message: 'empty' };
  if (trimmed === '—' || trimmed === '-') return { num: null, valid: false, message: 'empty' };
  const cleaned = trimmed.replace(/,/g, '').replace(/\s/g, '').replace(/%$/, '');
  if (!/^-?\d*(\.\d+)?$/.test(cleaned)) return { num: null, valid: false, message: 'NaN' };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { num: null, valid: false, message: 'NaN' };
  if (n < 0) return { num: n, valid: false, message: 'negative' };
  return { num: n, valid: true };
}

function pickEntity(entities: AiParseOptions['existingEntities'], value: string): { id: number | null; label: string; matches: AiParseOptions['existingEntities'] } {
  const trimmed = value.trim();
  if (!trimmed) return { id: null, label: '', matches: [] };
  const lower = trimmed.toLowerCase();
  const exact = entities.find(item => String(item.id).toLowerCase() === lower || (item.label ?? '').trim().toLowerCase() === lower);
  if (exact) {
    const numericId = typeof exact.id === 'number' ? exact.id : Number(exact.id);
    return { id: Number.isFinite(numericId) ? numericId : null, label: exact.label, matches: [exact] };
  }
  const contains = entities.filter(item => (item.label ?? '').toLowerCase().includes(lower));
  if (contains.length === 1) {
    const numericId = typeof contains[0].id === 'number' ? contains[0].id : Number(contains[0].id);
    return { id: Number.isFinite(numericId) ? numericId : null, label: contains[0].label, matches: contains };
  }
  return { id: null, label: '', matches: contains };
}

const LABELS: Record<AiFieldKey, string> = {
  adIdSlot: 'Slot',
  rate: 'Rate',
  traffic: 'Traffic',
  settlement: 'Settlement',
  dataCoefficient: 'DataCoeff',
  yiyiChannel: 'Channel',
  yiyiQty: 'Quantity',
};

function buildField(key: AiFieldKey, value: string, isNumber: boolean): AiPreviewField {
  const label = LABELS[key];
  if (!isNumber) {
    return { key, label, value, numericValue: null, valid: true };
  }
  const parsed = parseNumber(value);
  return {
    key,
    label,
    value,
    numericValue: parsed.num,
    valid: parsed.valid,
    message: parsed.message,
  };
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseAiImport(rawContent: string, options: AiParseOptions): AiParseResult {
  const start = performance.now();
  const notes: string[] = [];

  if (rawContent.length > AI_IMPORT_LIMITS.maxRawContentChars) {
    return {
      rows: [],
      summary: { total: 0, valid: 0, needsReview: 0, rejected: 1, notes: [`Input too large (${rawContent.length} chars). Max ${AI_IMPORT_LIMITS.maxRawContentChars}.`] },
      columnMap: {},
      rawSize: rawContent.length,
      detectedHeaders: [],
    };
  }

  const { grid, separator } = parseDelimited(rawContent);
  if (!grid.length) {
    return {
      rows: [], summary: { total: 0, valid: 0, needsReview: 0, rejected: 0, notes: ['No data rows detected.'] },
      columnMap: {}, rawSize: rawContent.length, detectedHeaders: [],
    };
  }

  // Detect header row
  const headerRowIdx = isHeaderRow(grid[0]) ? 0 : -1;
  const headers = headerRowIdx >= 0 ? grid[0] : grid[0].map((_, i) => `col${i + 1}`);
  const columnMap: Record<string, AiFieldKey | 'ignored' | 'date' | 'type'> = {};
  headers.forEach((header) => {
    columnMap[header] = mapHeader(header);
  });

  const dataRows = headerRowIdx >= 0 ? grid.slice(1) : grid;
  if (dataRows.length > AI_IMPORT_LIMITS.maxRows) {
    notes.push(`Truncated to first ${AI_IMPORT_LIMITS.maxRows} rows of ${dataRows.length}.`);
  }
  const sliced = dataRows.slice(0, AI_IMPORT_LIMITS.maxRows);

  const rows: AiPreviewRow[] = sliced.map((cells, rowIdx) => {
    const flags = new Set<AiRowStatus>();
    const fields: Record<string, AiPreviewField> = {};
    const source = cells.join(separator);

    const get = (key: AiFieldKey | 'date' | 'type'): string => {
      const idx = headers.findIndex(h => columnMap[h] === key);
      if (idx < 0) return '';
      return (cells[idx] ?? '').toString();
    };

    if (options.scope === 'yiyiDaily') {
      const channel = get('yiyiChannel');
      const qtyRaw = get('yiyiQty');
      fields.yiyiChannel = buildField('yiyiChannel', channel, false);
      fields.yiyiQty = buildField('yiyiQty', qtyRaw, true);
      if (!channel.trim()) flags.add('missingRequiredField');
      if (!fields.yiyiQty.valid) flags.add('invalidNumber');
      else if (fields.yiyiQty.numericValue !== null && fields.yiyiQty.numericValue < 0) flags.add('invalidNumber');
    } else {
      const slot = get('adIdSlot');
      const rateRaw = get('rate');
      const trafficRaw = get('traffic');
      const settlementRaw = get('settlement');
      const coeffRaw = get('dataCoefficient');

      fields.adIdSlot = buildField('adIdSlot', slot, false);
      fields.rate = buildField('rate', rateRaw, true);
      fields.traffic = buildField('traffic', trafficRaw, true);
      fields.settlement = buildField('settlement', settlementRaw, true);
      fields.dataCoefficient = buildField('dataCoefficient', coeffRaw, true);

      if (!slot.trim()) flags.add('missingRequiredField');
      if (!fields.rate.valid) flags.add('invalidNumber');
      if (!fields.traffic.valid) flags.add('invalidNumber');
      if (settlementRaw.trim() && !fields.settlement.valid) flags.add('invalidNumber');
      if (coeffRaw.trim() && !fields.dataCoefficient.valid) flags.add('invalidNumber');
    }

    // Resolve entity
    let resolvedEntityId: number | null = null;
    let resolvedEntityLabel = '';
    let confirmedConflict = false;
    let rateMismatch = false;

    if (options.scope === 'yiyiDaily') {
      const channel = fields.yiyiChannel.value.trim();
      const matched = options.existingEntities.find(item => String(item.id) === channel || item.label.trim() === channel);
      if (matched) {
        resolvedEntityLabel = matched.label;
      } else if (channel) {
        flags.add('ambiguous');
      } else {
        flags.add('missingRequiredField');
      }
    } else {
      const slotValue = fields.adIdSlot.value.trim();
      const pick = pickEntity(options.existingEntities, slotValue);
      if (pick.matches.length === 1) {
        resolvedEntityId = pick.id;
        resolvedEntityLabel = pick.label;
        const match = pick.matches[0];
        if (match?.status === 'confirmed') {
          flags.add('confirmedConflict');
          confirmedConflict = true;
        }
        if (match && typeof match.rate === 'number' && fields.rate.valid && fields.rate.numericValue !== null) {
          const expected = Number(match.rate);
          if (Number.isFinite(expected) && Math.abs(expected - fields.rate.numericValue) > 1e-6) {
            flags.add('rateMismatch');
            rateMismatch = true;
          }
        }
      } else if (pick.matches.length > 1) {
        flags.add('ambiguous');
        resolvedEntityLabel = `${pick.matches.length} candidates`;
      } else if (slotValue) {
        flags.add('ambiguous');
        resolvedEntityLabel = 'unmatched';
      } else {
        flags.add('missingRequiredField');
      }
    }

    // Decide final status
    let status: AiRowStatus = 'matched';
    if (confirmedConflict) status = 'confirmedConflict';
    else if (flags.has('invalidNumber') || flags.has('invalid')) status = 'invalid';
    else if (flags.has('ambiguous')) status = 'ambiguous';
    else if (flags.has('missingRequiredField')) status = 'missingRequiredField';
    else if (flags.has('rateMismatch')) status = 'rateMismatch';
    else status = 'matched';

    const blocking = status === 'confirmedConflict' || status === 'invalid' || status === 'ambiguous' || status === 'missingRequiredField';

    if (performance.now() - start > AI_IMPORT_LIMITS.parseTimeoutMs) {
      notes.push(`Stopped parsing after row ${rowIdx + 1} (timeout).`);
      return null as unknown as AiPreviewRow;
    }

    return {
      id: `row-${rowIdx}`,
      status,
      flags: Array.from(flags),
      fields,
      resolvedEntityId,
      resolvedEntityLabel,
      confirmedConflict,
      rateMismatch,
      source,
      blocking,
    };
  }).filter(Boolean) as AiPreviewRow[];

  if (rows.length < dataRows.length) {
    notes.push(`Only ${rows.length} of ${dataRows.length} rows were parsed within the time limit.`);
  }

  const summary: AiParseSummary = {
    total: rows.length,
    valid: rows.filter(r => r.status === 'matched' || r.status === 'rateMismatch').length,
    needsReview: rows.filter(r => r.status === 'rateMismatch' || r.status === 'ambiguous' || r.status === 'missingRequiredField').length,
    rejected: rows.filter(r => r.status === 'invalid' || r.status === 'confirmedConflict').length,
    notes,
  };

  return {
    rows,
    summary,
    columnMap,
    rawSize: rawContent.length,
    detectedHeaders: headers,
  };
}

/** Build a draft advertiser/media row update from a preview row. */
export function applyPreviewToAdvertiserDraft(preview: AiPreviewRow, baseRow: { adIdNum: number; rate: string; traffic: string; settlement: string }) {
  return {
    adIdNum: preview.resolvedEntityId ?? baseRow.adIdNum,
    rate: preview.fields.rate.value,
    traffic: preview.fields.traffic.value,
    settlement: preview.fields.settlement.value,
  };
}

export function applyPreviewToMediaDraft(preview: AiPreviewRow, baseRow: { upstreamAdIdNum: number; rate: string; traffic: string; settlement: string; dataCoefficient: string }) {
  return {
    upstreamAdIdNum: preview.resolvedEntityId ?? baseRow.upstreamAdIdNum,
    rate: preview.fields.rate.value,
    traffic: preview.fields.traffic.value,
    settlement: preview.fields.settlement.value,
    dataCoefficient: preview.fields.dataCoefficient.value,
  };
}

export function applyPreviewToYiyiDraft(preview: AiPreviewRow) {
  return {
    channel: preview.fields.yiyiChannel.value.trim(),
    qty: preview.fields.yiyiQty.numericValue ?? 0,
  };
}

export function statusLabel(status: AiRowStatus): string {
  switch (status) {
    case 'matched': return 'matched';
    case 'ambiguous': return 'needs review';
    case 'missingRequiredField': return 'missing field';
    case 'invalidNumber': return 'invalid number';
    case 'confirmedConflict': return 'confirmed record';
    case 'rateMismatch': return 'rate mismatch';
    case 'invalid': return 'invalid';
  }
}

export function scopeFieldKeys(scope: AiTargetScope): AiFieldKey[] {
  if (scope === 'yiyiDaily') return ['yiyiChannel', 'yiyiQty'];
  return ['adIdSlot', 'rate', 'traffic', 'settlement', 'dataCoefficient'];
}
