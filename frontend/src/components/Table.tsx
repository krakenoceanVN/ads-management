import React from 'react';
import { useAppContext } from '../AppContext';
import {
  Table as UITable,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from './ui/table';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key?: keyof T | '__no__' | '__actions__' | '__count__';
  label: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortClick?: () => void;
}

interface TableProps<T> {
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  columns: Column<T>[];
  data: T[];
  emptyText?: string;
}

export function Table<T>({ columns, data, emptyText = '—', onEdit, onDelete }: TableProps<T>) {
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
      <UITable>
        <TableHeader>
          <TableRow>
            {columns.map((c, i) => {
              if (c.onSortClick) {
                const arrow = c.sortDirection === 'asc' ? '▲' : c.sortDirection === 'desc' ? '▼' : '↕';
                return (
                  <TableHead key={i} className="th-sortable" aria-sort={c.sortDirection === 'asc' ? 'ascending' : c.sortDirection === 'desc' ? 'descending' : 'none'}>
                    <button type="button" className="th-sort-btn" onClick={c.onSortClick}>
                      <span>{c.label}</span>
                      <span className={`th-sort-indicator ${c.sortDirection ? 'is-sorted' : ''}`} aria-hidden="true">{arrow}</span>
                    </button>
                  </TableHead>
                );
              }
              return <TableHead key={i}>{c.label}</TableHead>;
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((c, colIndex) => {
                if (c.key === '__no__') return <TableCell key={colIndex} className="td-no">{rowIndex + 1}</TableCell>;
                if (c.key === '__actions__') {
                  if (c.render) return <TableCell key={colIndex}>{c.render(row, rowIndex)}</TableCell>;
                  if (!onEdit && !onDelete) return <TableCell key={colIndex}>—</TableCell>;
                  return (
                    <TableCell key={colIndex} className="td-actions">
                      {onEdit && (
                        <button
                          type="button"
                          className="action-btn"
                          title={t('edit')}
                          onClick={() => onEdit(row)}
                        >✏️</button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="action-btn action-btn-danger"
                          title={t('delete')}
                          onClick={() => onDelete(row)}
                        >🗑️</button>
                      )}
                    </TableCell>
                  );
                }
                if (c.render) return <TableCell key={colIndex}>{c.render(row, rowIndex)}</TableCell>;
                return <TableCell key={colIndex}>{String((row as any)[c.key as any] || '')}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  );
}

export function TypeTag({ tp }: { tp: string }) {
  const cls = tp === 'CPM' ? 'tag-cpm' : tp === 'CPC' ? 'tag-cpc' : tp === 'CPA' ? 'tag-cpa' : 'tag-cps';
  return <span className={`tag ${cls}`}>{tp}</span>;
}

export function StatusTag({ s, label }: { s: string, label: string }) {
  const map: Record<string, string> = { settled: 'tag-success', pending: 'tag-pending', paid: 'tag-paid' };
  return <span className={`tag ${map[s] || ''}`}>{label || s}</span>;
}
