import React, { useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { DatePickerInput } from '../components/DatePickerInput';
import { PageHeader } from '../components/common/PageHeader';
import { TableCard } from '../components/common/TableCard';
import { getYiyiMonthlyData, saveYiyiDailyData, type YiyiChannelData } from '../api/yiyiApi';

const YIYI_CHANNELS = ['yy-02-01', 'yy-02-02', 'yy-02-03', 'yy-02-04'] as const;

function todayString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function YiyiData() {
  const { t, can } = useAppContext();
  const [date, setDate] = useState(todayString());
  const [channels, setChannels] = useState<YiyiChannelData[]>(
    YIYI_CHANNELS.map(channel => ({ channel, qty: 0, hasData: false }))
  );
  const [unitPrice, setUnitPrice] = useState('2');
  const [profitUnitPrice, setProfitUnitPrice] = useState('1');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canWrite = can('dataEntry.create') || can('dataEntry.write') || can('perm_data_input');
  const totalQty = channels.reduce((sum, channel) => sum + channel.qty, 0);
  const activeChannelCount = channels.filter(channel => channel.hasData || channel.qty > 0).length;
  const unitPriceValue = Number(unitPrice);
  const profitUnitPriceValue = Number(profitUnitPrice);
  const vendorAmount = Number.isFinite(unitPriceValue) ? (totalQty * unitPriceValue) / 1000 : 0;
  const profitAmount = Number.isFinite(profitUnitPriceValue) ? (totalQty * profitUnitPriceValue) / 1000 : 0;

  const DEFAULT_UNIT_PRICE = 2;
  const DEFAULT_PROFIT_UNIT_PRICE = 1;

  const loadData = useCallback(async (d: string) => {
    if (!d) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [year, month] = d.split('-').map(Number);
      const monthlyData = await getYiyiMonthlyData({ year, month });
      const row = monthlyData.find(r => r.date === d);

      if (row) {
        setChannels([
          { channel: 'yy-02-01', qty: row['yy-02-01'], hasData: row['yy-02-01'] > 0 },
          { channel: 'yy-02-02', qty: row['yy-02-02'], hasData: row['yy-02-02'] > 0 },
          { channel: 'yy-02-03', qty: row['yy-02-03'], hasData: row['yy-02-03'] > 0 },
          { channel: 'yy-02-04', qty: row['yy-02-04'], hasData: row['yy-02-04'] > 0 },
        ]);
        setUnitPrice(String(row.unit_price));
        setProfitUnitPrice(String(row.profit_unit_price));
      } else {
        setChannels(YIYI_CHANNELS.map(channel => ({ channel, qty: 0, hasData: false })));
        setUnitPrice(String(DEFAULT_UNIT_PRICE));
        setProfitUnitPrice(String(DEFAULT_PROFIT_UNIT_PRICE));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData(date);
  }, [date, loadData]);

  const updateQty = (channel: string, value: string) => {
    const num = Number(value);
    if (value !== '' && (Number.isNaN(num) || num < 0)) return;
    setChannels(prev =>
      prev.map(c => (c.channel === channel ? { ...c, qty: value === '' ? 0 : num } : c))
    );
  };

  const handleSave = async () => {
    if (!date) {
      setError(t('requiredFields'));
      return;
    }

    const unitPriceNum = Number(unitPrice);
    const profitUnitPriceNum = Number(profitUnitPrice);
    if (Number.isNaN(unitPriceNum) || unitPriceNum < 0) {
      setError('unitPrice must be >= 0');
      return;
    }
    if (Number.isNaN(profitUnitPriceNum) || profitUnitPriceNum < 0) {
      setError('profitUnitPrice must be >= 0');
      return;
    }

    for (const ch of channels) {
      if (Number.isNaN(ch.qty) || ch.qty < 0) {
        setError('qty must be >= 0');
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await saveYiyiDailyData({
        date,
        channels: channels.map(c => ({ channel: c.channel, qty: c.qty })),
        unit_price: unitPriceNum,
        profit_unit_price: profitUnitPriceNum,
      });
      setSuccess(t('saved'));
      await loadData(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page active yiyi-entry-page">
      <PageHeader
        eyebrow={t('dataEntry') || '数据录入'}
        title={t('pYiyiEntry')}
        description={canWrite ? date : `${date} · Read only`}
        actions={(
          <DatePickerInput
            placeholder={t('date')}
            className="input-sm filter-date yiyi-entry-date"
            value={date}
            onChange={setDate}
          />
        )}
      />

      <div className="yiyi-entry-overview">
        <div className="yiyi-entry-metric">
          <span className="yiyi-entry-metric-label">Quantity</span>
          <strong>{totalQty.toLocaleString()}</strong>
          <span>{activeChannelCount}/{YIYI_CHANNELS.length} channels</span>
        </div>
        <div className="yiyi-entry-metric">
          <span className="yiyi-entry-metric-label">Vendor amount</span>
          <strong>{vendorAmount.toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong>
          <span>quantity × unitPrice / 1000</span>
        </div>
        <div className="yiyi-entry-metric">
          <span className="yiyi-entry-metric-label">Profit</span>
          <strong>{profitAmount.toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong>
          <span>quantity × profitUnitPrice / 1000</span>
        </div>
      </div>

      <TableCard
        className="yiyi-entry-card"
        title={date}
        description={canWrite ? t('saveSystem') : 'Read only'}
      >
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}

        {loading ? (
          <div className="yiyi-entry-loading">Loading...</div>
        ) : (
          <div className="yiyi-entry-body-grid">
            <div className="table-wrap yiyi-entry-table-wrap">
              <table className="entry-table yiyi-entry-table">
                <thead>
                  <tr>
                    <th>{t('channel') || 'Channel'}</th>
                    <th>Quantity</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map(ch => (
                    <tr key={ch.channel}>
                      <td><span className="yiyi-entry-channel">{ch.channel}</span></td>
                      <td>
                        <input
                          className="cell-input yiyi-entry-qty-input"
                          type="number"
                          min="0"
                          value={ch.qty}
                          disabled={!canWrite || saving}
                          onChange={e => updateQty(ch.channel, e.target.value)}
                        />
                      </td>
                      <td>
                        <span className={`yiyi-entry-status ${ch.hasData ? 'is-saved' : 'is-empty'}`}>
                          {ch.hasData ? t('saved') : '--'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className="yiyi-pricing-section">
              <div className="yiyi-pricing-header">
                <h3>{t('yiyiPricing') || 'Yiyi Pricing'}</h3>
                <p>amount = quantity × unitPrice / 1000</p>
              </div>
              <div className="yiyi-pricing-row">
                <div className="yiyi-pricing-field">
                  <label>unitPrice</label>
                  <input
                    className="cell-input"
                    type="number"
                    min="0"
                    value={unitPrice}
                    disabled={!canWrite || saving}
                    onChange={e => setUnitPrice(e.target.value)}
                  />
                </div>
                <div className="yiyi-pricing-field">
                  <label>profitUnitPrice</label>
                  <input
                    className="cell-input"
                    type="number"
                    min="0"
                    value={profitUnitPrice}
                    disabled={!canWrite || saving}
                    onChange={e => setProfitUnitPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="yiyi-pricing-formula">profit = quantity × profitUnitPrice / 1000</div>
            </aside>
          </div>
        )}

        <div className="yiyi-entry-actions">
          <span className={`yiyi-entry-permission ${canWrite ? 'can-write' : 'read-only'}`}>
            {canWrite ? t('saveSystem') : 'Read only'}
          </span>
          {canWrite && (
            <button
              className="btn-primary"
              disabled={saving || loading}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving...' : t('saveSystem')}
            </button>
          )}
        </div>
      </TableCard>
    </div>
  );
}