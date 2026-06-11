import React from 'react';

type KpiCardProps = {
  tone?: 'revenue' | 'expense' | 'profit' | 'net' | 'default';
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  sub?: React.ReactNode;
};

export function KpiCard({ tone = 'default', label, value, icon, sub }: KpiCardProps) {
  return (
    <div className={`kpi-card kpi-card-${tone}`}>
      {icon && <div className="kpi-card-icon">{icon}</div>}
      <div className="kpi-card-content">
        <div className="kpi-card-label">{label}</div>
        <div className="kpi-card-value">{value}</div>
        {sub && <div className="kpi-card-sub">{sub}</div>}
      </div>
    </div>
  );
}
