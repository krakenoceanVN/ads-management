import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { visibleMenu } from '../lib/featureFlags';
import { getUsernameFromToken } from '../lib/bffApi';

export function Sidebar() {
  const { t, currentPage, setCurrentPage } = useAppContext();
  const [username, setUsername] = useState(() => getUsernameFromToken());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    visibleMenu.forEach(g => {
      if (g.children && g.children.some(c => c.key === currentPage)) {
        init[g.key] = true;
      }
    });
    return init;
  });

  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const handler = () => setUsername(getUsernameFromToken());
    window.addEventListener('storage', handler);
    window.addEventListener('bff-auth-token-invalid', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('bff-auth-token-invalid', handler);
    };
  }, []);

  return (
    <nav id="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-icon">🦑</div>
        <div className="sb-logo-name">KrakenOcean</div>
      </div>
      <div className="sb-nav">
        {visibleMenu.map(group => {
          if (group.single) {
            const active = currentPage === group.key ? 'active' : '';
            return (
              <div key={group.key} className={`sb-single ${active}`} onClick={() => setCurrentPage(group.key)}>
                <span className="icon">{group.icon}</span>{t(group.key)}
              </div>
            );
          }

          const isOpen = openGroups[group.key];
          return (
            <div key={group.key} className="sb-group">
              <div className={`sb-group-header ${isOpen ? 'open' : ''}`} onClick={() => toggleGroup(group.key)}>
                <span><span className="icon">{group.icon}</span>{t(group.key)}</span>
                <span className="arrow">▶</span>
              </div>
              <div className={`sb-children ${isOpen ? 'open' : ''}`}>
                {group.children?.map(c => (
                  <div key={c.key} className={`sb-child ${currentPage === c.key ? 'active' : ''}`} onClick={() => setCurrentPage(c.key)}>
                    {t(c.key)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sb-footer">
        <div className="sb-user">
          <div className="sb-avatar">{getUsernameFromToken().charAt(0).toUpperCase()}</div>
          <div>
            <div className="sb-username">{getUsernameFromToken()}</div>
            <div className="sb-role">{t('roleAdmin')}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
