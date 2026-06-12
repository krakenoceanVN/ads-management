import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AI_IMPORT_LIMITS,
  AiParseOptions,
  AiPreviewRow,
  AiRowStatus,
  AiTargetScope,
  parseAiImport,
  scopeFieldKeys,
  statusLabel,
} from '../lib/aiImport';
import { useAppContext } from '../AppContext';

type AiDataInputDrawerProps = {
  open: boolean;
  onClose: () => void;
  scope: AiTargetScope;
  scopeLabel: string;
  date: string;
  adTypeCode?: string;
  entities: AiParseOptions['existingEntities'];
  /** Returns preview rows for caller to apply. */
  onApply: (rows: AiPreviewRow[]) => void;
  /** Whether the current user can apply (write) draft data. */
  canApply: boolean;
};

const STATUS_TONE: Record<AiRowStatus, string> = {
  matched: 'is-ok',
  rateMismatch: 'is-warn',
  ambiguous: 'is-warn',
  missingRequiredField: 'is-warn',
  invalidNumber: 'is-error',
  invalid: 'is-error',
  confirmedConflict: 'is-block',
};

export function AiDataInputDrawer({
  open,
  onClose,
  scope,
  scopeLabel,
  date,
  adTypeCode,
  entities,
  onApply,
  canApply,
}: AiDataInputDrawerProps) {
  const { t } = useAppContext();
  const [rawContent, setRawContent] = useState('');
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseAiImport> | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) {
      setRawContent('');
      setParseResult(null);
      setEditingRowId(null);
    } else {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [open, onClose]);

  const options: AiParseOptions = useMemo(() => ({
    scope,
    existingEntities: entities,
    date,
    adTypeCode,
  }), [scope, entities, date, adTypeCode]);

  const handleParse = () => {
    if (!rawContent.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseAiImport(rawContent, options);
    setParseResult(result);
  };

  const updateField = (rowId: string, fieldKey: string, value: string) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      rows: parseResult.rows.map(row => {
        if (row.id !== rowId) return row;
        const fields = { ...row.fields, [fieldKey]: { ...row.fields[fieldKey], value, valid: row.fields[fieldKey].valid } };
        return { ...row, fields };
      }),
    });
  };

  const toggleValidFlag = (rowId: string, fieldKey: string) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      rows: parseResult.rows.map(row => {
        if (row.id !== rowId) return row;
        const fields = { ...row.fields, [fieldKey]: { ...row.fields[fieldKey], valid: !row.fields[fieldKey].valid } };
        return { ...row, fields };
      }),
    });
  };

  const removeRow = (rowId: string) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      rows: parseResult.rows.filter(row => row.id !== rowId),
    });
  };

  const handleApply = () => {
    if (!parseResult) return;
    const validRows = parseResult.rows.filter(row => !row.blocking);
    if (!validRows.length) return;
    onApply(validRows);
    onClose();
  };

  if (!open) return null;

  const fieldKeys = scopeFieldKeys(scope);
  const summary = parseResult?.summary;
  const tooLarge = rawContent.length > AI_IMPORT_LIMITS.maxRawContentChars;

  return createPortal(
    <div
      className="ai-drawer-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ai-drawer"
        role="dialog"
        aria-label="AI Data Input Assistant"
        aria-modal="true"
      >
          <header className="ai-drawer-header">
            <div>
              <div className="ai-drawer-eyebrow">AI Data Input Assistant</div>
              <h2 className="ai-drawer-title">{scopeLabel}</h2>
              <div className="ai-drawer-description">
                {date}
                {adTypeCode ? ` · ${adTypeCode}` : ''}
                {' · '}
                {canApply ? 'Write' : 'Read only'}
              </div>
            </div>
            <button type="button" className="ai-drawer-close" onClick={onClose} aria-label="Close">×</button>
          </header>

          <section className="ai-drawer-body">
            <div className="ai-drawer-help">
              <strong>How it works:</strong> paste CSV or tab-separated rows.
              The assistant parses them into preview rows so you can review, fix
              ambiguities, and apply only the valid rows to the existing draft.
              The assistant never saves, confirms, or deletes data.
            </div>

            <div className="ai-drawer-form">
              <label className="ai-drawer-label">
                <span>Pasted data</span>
                <span className="ai-drawer-counter">{rawContent.length.toLocaleString()} / {AI_IMPORT_LIMITS.maxRawContentChars.toLocaleString()} chars</span>
              </label>
              <textarea
                ref={textareaRef}
                className="ai-drawer-textarea"
                placeholder={'Slot\tRate\tTraffic\tSettlement\nABC001\t1.2\t5000\t—'}
                value={rawContent}
                onChange={e => setRawContent(e.target.value)}
                spellCheck={false}
                rows={6}
              />
              {tooLarge && <div className="ai-drawer-error">Input exceeds the maximum allowed size.</div>}
              <div className="ai-drawer-actions">
                <button type="button" className="btn-outline" onClick={() => setRawContent('')}>Clear</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleParse}
                  disabled={!rawContent.trim() || tooLarge}
                >
                  Parse preview
                </button>
              </div>
            </div>

            {summary && (
              <div className="ai-drawer-summary">
                <div className="ai-drawer-summary-tile">
                  <span className="ai-drawer-summary-label">Total rows</span>
                  <strong>{summary.total}</strong>
                </div>
                <div className="ai-drawer-summary-tile is-ok">
                  <span className="ai-drawer-summary-label">Valid</span>
                  <strong>{summary.valid}</strong>
                </div>
                <div className="ai-drawer-summary-tile is-warn">
                  <span className="ai-drawer-summary-label">Needs review</span>
                  <strong>{summary.needsReview}</strong>
                </div>
                <div className="ai-drawer-summary-tile is-error">
                  <span className="ai-drawer-summary-label">Rejected</span>
                  <strong>{summary.rejected}</strong>
                </div>
              </div>
            )}

            {parseResult && parseResult.rows.length > 0 && (
              <div className="ai-drawer-preview">
                <div className="ai-drawer-preview-header">
                  <h3>Preview</h3>
                  <span className="ai-drawer-hint">Click a field to edit. Click status to toggle. Use × to remove a row.</span>
                </div>
                <div className="ai-drawer-preview-wrap">
                  <table className="ai-drawer-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Status</th>
                        {fieldKeys.map(key => <th key={key}>{key}</th>)}
                        <th>Resolved</th>
                        <th>Source</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.map((row, idx) => (
                        <tr key={row.id} className={`ai-drawer-row ${STATUS_TONE[row.status]}`}>
                          <td>{idx + 1}</td>
                          <td>
                            <span className={`ai-drawer-pill ${STATUS_TONE[row.status]}`}>
                              {statusLabel(row.status)}
                            </span>
                          </td>
                          {fieldKeys.map(key => {
                            const field = row.fields[key];
                            if (!field) return <td key={key}></td>;
                            const editing = editingRowId === row.id + ':' + key;
                            return (
                              <td key={key}>
                                {editing ? (
                                  <input
                                    className="ai-drawer-input"
                                    value={field.value}
                                    onChange={e => updateField(row.id, key, e.target.value)}
                                    onBlur={() => setEditingRowId(null)}
                                    onKeyDown={e => { if (e.key === 'Enter') setEditingRowId(null); }}
                                  />
                                ) : (
                                  <span
                                    className={`ai-drawer-cell ${field.valid ? '' : 'is-invalid'}`}
                                    onClick={() => setEditingRowId(row.id + ':' + key)}
                                    title="Click to edit"
                                  >
                                    {field.value || <em className="ai-drawer-empty">empty</em>}
                                  </span>
                                )}
                                {!field.valid && (
                                  <button
                                    type="button"
                                    className="ai-drawer-mini"
                                    onClick={() => toggleValidFlag(row.id, key)}
                                    title="Mark as fixed"
                                  >✓</button>
                                )}
                              </td>
                            );
                          })}
                          <td>
                            <span className="ai-drawer-resolved">
                              {row.resolvedEntityLabel || (row.confirmedConflict ? 'confirmed' : 'unmatched')}
                            </span>
                          </td>
                          <td className="ai-drawer-source">{row.source.length > 60 ? row.source.slice(0, 60) + '…' : row.source}</td>
                          <td>
                            <button type="button" className="ai-drawer-mini" onClick={() => removeRow(row.id)} title="Remove row">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {summary && summary.notes.length > 0 && (
                  <ul className="ai-drawer-notes">
                    {summary.notes.map((note, i) => <li key={i}>{note}</li>)}
                  </ul>
                )}
              </div>
            )}

            {parseResult && parseResult.rows.length === 0 && (
              <div className="ai-drawer-empty-state">No data rows detected in the paste.</div>
            )}
          </section>

          <footer className="ai-drawer-footer">
            <span className="ai-drawer-permission">
              {canApply
                ? (t('saveSystem') || 'Apply to draft')
                : 'Read only · apply disabled'}
            </span>
            <div className="ai-drawer-footer-actions">
              <button type="button" className="btn-outline" onClick={onClose}>Close</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApply}
                disabled={!canApply || !parseResult || !parseResult.rows.some(row => !row.blocking)}
              >
                Apply valid rows to draft
              </button>
            </div>
          </footer>
        </div>
      </div>
  , document.body);
}
