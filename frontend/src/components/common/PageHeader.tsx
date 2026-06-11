import React from 'react';

type PageHeaderProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions, children }: PageHeaderProps) {
  return (
    <header className="page-header page-header-card">
      <div className="page-header-main">
        {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
        <h1 className="page-title page-header-title">{title}</h1>
        {description && <div className="page-header-description">{description}</div>}
      </div>
      {(actions || children) && <div className="page-header-actions">{actions || children}</div>}
    </header>
  );
}
