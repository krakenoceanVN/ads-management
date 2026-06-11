import React from 'react';

type TableCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function TableCard({ title, description, toolbar, children, className = '' }: TableCardProps) {
  const hasHeader = title || description || toolbar;
  return (
    <section className={`card table-card ${className}`.trim()}>
      {hasHeader && (
        <div className="table-card-header">
          {(title || description) && (
            <div className="table-card-heading">
              {title && <h2 className="table-card-title">{title}</h2>}
              {description && <div className="table-card-description">{description}</div>}
            </div>
          )}
          {toolbar && <div className="table-card-toolbar">{toolbar}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
