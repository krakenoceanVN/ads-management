import React from 'react';
import { useAppContext } from '../AppContext';

export interface Column<T> {
  key?: keyof T | '__no__' | '__actions__' | '__count__';
  label: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
  onEdit?: (row: T) => void;
  columns: Column<T>[];
  data: T[];
  emptyText?: string;
}

export function Table<T>({ columns, data, emptyText = '—', onEdit }: TableProps<T>) {
  const { t } = useAppContext();

  if (!data.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((c, colIndex) => {
                if (c.key === '__no__') return <td key={colIndex} className="td-no">{rowIndex + 1}</td>;
                if (c.key === '__actions__') return (
                  <td key={colIndex}>
                    <button className="action-btn" title={t('edit')} onClick={() => onEdit && onEdit(row)}>✏️</button>
                  </td>
                );
                if (c.render) return <td key={colIndex}>{c.render(row, rowIndex)}</td>;
                return <td key={colIndex}>{String((row as any)[c.key as any] || '')}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TypeTag({ tp }: { tp: string }) {
  const cls = tp === 'CPM' ? 'tag-cpm' : tp === 'CPA' ? 'tag-cpa' : 'tag-cps';
  return <span className={`tag ${cls}`}>{tp}</span>;
}

export function StatusTag({ s, label }: { s: string, label: string }) {
  const map: Record<string, string> = { settled: 'tag-success', pending: 'tag-pending', paid: 'tag-paid' };
  return <span className={`tag ${map[s] || ''}`}>{label || s}</span>;
}
