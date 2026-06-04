import React, { useState } from 'react';
import { DatePickerInput } from './DatePickerInput';
import type { QuarantineScope } from '../hooks/useQuarantineAction';

interface QuarantineConfirmModalProps {
  open: boolean;
  scope: QuarantineScope;
  targetName: string;
  loading: boolean;
  error: string | null;
  result: { recordCount: number; totalRevenue: string } | null;
  onConfirm: (params: { startDate: string; endDate: string; reason?: string }) => Promise<unknown>;
  onClose: () => void;
}

export function QuarantineConfirmModal({
  open,
  scope,
  targetName,
  loading,
  error,
  result,
  onConfirm,
  onClose,
}: QuarantineConfirmModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleConfirm = async () => {
    if (!startDate || !endDate) return;
    await onConfirm({ startDate, endDate, reason: reason || undefined });
  };

  const handleClose = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    onClose();
  };

  const scopeLabel = scope === 'advertiser' ? 'Nhà quảng cáo' : 'Đối tác media';

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !loading) handleClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Cô lập dữ liệu nhập</span>
          <button className="modal-close" onClick={handleClose} disabled={loading}>x</button>
        </div>
        <div className="modal-body">
          {result ? (
            <div className="quarantine-success">
              <div className="quarantine-success-icon">✓</div>
              <div className="quarantine-success-title">Đã cô lập thành công!</div>
              <div className="quarantine-success-detail">
                Đã cô lập <strong>{result.recordCount}</strong> bản ghi với tổng doanh thu{' '}
                <strong>{result.totalRevenue}</strong> cho <strong>{scopeLabel}: {targetName}</strong>
              </div>
              <div className="quarantine-success-note">
                Dữ liệu đã cô lập vẫn còn trong hệ thống nhưng không xuất hiện trong báo cáo.
              </div>
            </div>
          ) : (
            <>
              <div className="quarantine-warning">
                <div className="quarantine-warning-icon">⚠️</div>
                <div className="quarantine-warning-text">
                  Thao tác này <strong>KHÔNG xóa dữ liệu gốc</strong> và <strong>KHÔNG xóa đối tượng</strong> đang chọn.
                  Dữ liệu nhập hàng ngày trong khoảng thời gian chọn sẽ bị <strong>CÔ LẬP</strong> và không còn xuất hiện trong báo cáo.
                </div>
              </div>

              <div className="form-group">
                <label>Đối tượng</label>
                <div className="form-value">{scopeLabel}: {targetName}</div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Từ ngày <span className="required">*</span></label>
                  <DatePickerInput
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="form-group">
                  <label>Đến ngày <span className="required">*</span></label>
                  <DatePickerInput
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Lý do (tùy chọn)</label>
                <textarea
                  className="form-textarea"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Nhập lý do cô lập (không bắt buộc)"
                  rows={3}
                />
              </div>

              {error && <div className="form-error">{error}</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          {result ? (
            <button className="btn-primary" onClick={handleClose}>Đóng</button>
          ) : (
            <>
              <button className="btn-outline" onClick={handleClose} disabled={loading}>Hủy</button>
              <button
                className="btn-danger"
                onClick={handleConfirm}
                disabled={loading || !startDate || !endDate}
              >
                {loading ? 'Đang xử lý...' : 'Cô lập dữ liệu'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
