import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { listOperationLogs } from '../lib/bffApi';
import type { OperationLogDto } from '../lib/bffTypes';

type OpLogRow = {
  time: string;
  op: string;
  mod: string;
  action: string;
};

export function OpLog() {
  const { t, renderLog } = useAppContext();
  const [rows, setRows] = useState<OpLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    keyword: '',
    module: '',
    action: '',
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listOperationLogs({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        keyword: filters.keyword || undefined,
        module: filters.module || undefined,
        action: filters.action || undefined,
        pageSize: 100,
      });

      const mapped: OpLogRow[] = result.items.map((log: OperationLogDto) => ({
        time: new Date(log.createdAt).toLocaleString('zh', { hour12: false }),
        op: log.username || '—',
        mod: log.module,
        action: `${log.action}${log.targetId ? ` ${log.targetId}` : ''}${log.detail ? ` - ${log.detail}` : ''}`,
      }));
      setRows(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operation logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="page active">
      <div className="page-header"><h1 className="page-title">{t('mOpLog')}</h1></div>
      <div className="card">
        <div className="report-filters">
          <input
            type="date"
            className="search-input"
            style={{ minWidth: '140px' }}
            placeholder={t('startDate')}
            value={filters.startDate}
            onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <span style={{ color: 'var(--text-sub)' }}>—</span>
          <input
            type="date"
            className="search-input"
            style={{ minWidth: '140px' }}
            placeholder={t('endDate')}
            value={filters.endDate}
            onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
          />
          <input
            className="search-input"
            placeholder={t('search')}
            value={filters.keyword}
            onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') void loadLogs(); }}
          />
          <button className="btn-primary btn-sm" onClick={() => void loadLogs()}>
            {t('query')}
          </button>
        </div>
        {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
        <Table
          columns={[
            { key: 'time', label: t('time') },
            { key: 'op', label: t('operator') },
            { key: 'mod', label: t('module') },
            { key: 'action', label: t('operation') },
          ]}
          data={rows}
          loading={loading}
          emptyText={rows.length === 0 && !loading ? t('search') + '...' : undefined}
        />
      </div>
    </div>
  );
}