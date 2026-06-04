import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { visibleMenu } from '../lib/featureFlags';

const PAGE_PERMISSION_MAP: Record<string, string> = {
  pAdvertiserList: 'advertiser.read',
  pAdOrderMgmt: 'role.update',
  pAdIdMgmt: 'adId.read',
  pMediaMgmt: 'media.read',
  pMediaAdOrderMgmt: 'media.read',
  pMediaIdMgmt: 'media.read',
  pDownstreamMgmt: 'media.read',
  pAiEntry: 'dataEntry.read',
  pAdvEntry: 'dataEntry.read',
  pMediaDataMgmt: 'dataEntry.read',
  pYiyiEntry: 'dataEntry.read',
  pYiyiReport: 'report.read',
  pTotalProfit: 'report.read',
  pOrderProfit: 'report.read',
  pAdvQuery: 'report.read',
  pMediaQuery: 'report.read',
  pAdvSettlement: 'settlement.read',
  pMediaSettlement: 'settlement.read',
  mOpLog: 'auditLog.read',
  pUserManagement: 'user.read',
  pRoleManagement: 'role.read',
  pQuarantineMgmt: 'quarantine.execute',
  pAdTypeMgmt: 'role.update',
};

export function Sidebar() {
  const { t, currentPage, setCurrentPage, currentUser, can } = useAppContext();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    visibleMenu.forEach(g => {
      if (g.children && g.children.some(c => {
        const requiredPerm = PAGE_PERMISSION_MAP[c.key];
        return requiredPerm && can(requiredPerm) && c.key === currentPage;
      })) {
        init[g.key] = true;
      }
    });
    return init;
  });

  useEffect(() => {
    const init: Record<string, boolean> = {};
    visibleMenu.forEach(g => {
      if (g.children && g.children.some(c => {
        const requiredPerm = PAGE_PERMISSION_MAP[c.key];
        return requiredPerm && can(requiredPerm) && c.key === currentPage;
      })) {
        init[g.key] = true;
      }
    });
    setOpenGroups(init);
  }, [currentPage, can, currentUser]);

  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const username = currentUser?.username || '-';
  const avatarLetter = username.charAt(0).toUpperCase();
  const roleLabel = currentUser?.roleName || currentUser?.roleCode || currentUser?.role || '-';

  return (
    <nav id="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-icon"><img src="/logo.jpg" alt="KrakenOcean logo" /></div>
        <div className="sb-logo-name">KrakenOcean</div>
      </div>
      <div className="sb-nav">
        {visibleMenu.map(group => {
          // Filter children by permission
          const visibleChildren = group.children?.filter(c => {
            const requiredPerm = PAGE_PERMISSION_MAP[c.key];
            if (!requiredPerm) return true; // no permission required
            return can(requiredPerm);
          }) ?? [];

          // Skip group if no visible children
          if (group.children && visibleChildren.length === 0) return null;

          if (group.single) {
            const requiredPerm = PAGE_PERMISSION_MAP[group.key];
            if (requiredPerm && !can(requiredPerm)) return null;
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
                {visibleChildren.map(c => (
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
          <div className="sb-avatar">{avatarLetter}</div>
          <div>
            <div className="sb-username">{username}</div>
            <div className="sb-role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}