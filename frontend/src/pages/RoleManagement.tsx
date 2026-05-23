import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { getPermissions, getRoles, updateRolePermissions } from '../lib/bffApi';
import type { Permission, Role } from '../lib/bffTypes';

const MODULES = ['user', 'role', 'advertiser', 'adOrder', 'adId', 'media', 'dataEntry', 'report', 'settlement', 'auditLog', 'system'];

const ROLE_DESCRIPTIONS: Record<string, { zh: string; vi: string; en: string }> = {
  SUPER_ADMIN: {
    zh: '系统所有者，拥有全部权限，不可修改',
    vi: 'Chủ sở hữu hệ thống, có tất cả quyền, không thể sửa đổi',
    en: 'System owner, full access, cannot be modified',
  },
  ADMIN: {
    zh: '系统管理员，管理大部分模块和用户',
    vi: 'Quản trị viên, quản lý hầu hết các module và người dùng',
    en: 'System administrator, manages most modules and users',
  },
  OPERATOR: {
    zh: '运营人员，输入和确认数据，查看报表',
    vi: 'Nhân viên vận hành, nhập và xác nhận dữ liệu, xem báo cáo',
    en: 'Operator, enters and confirms data, views reports',
  },
  VIEWER: {
    zh: '只读用户，可查看被允许的数据和报表',
    vi: 'Người chỉ đọc, có thể xem dữ liệu và báo cáo được phép',
    en: 'Read-only user, can view allowed data and reports',
  },
};

function getRoleDescription(code: string, lang: 'zh' | 'vi' | 'en'): string {
  return ROLE_DESCRIPTIONS[code]?.[lang] ?? '';
}

export function RoleManagement() {
  const { t, can, lang: appLang } = useAppContext();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [editRole, setEditRole] = useState<Role | null>(null);
  const [selectedPermKeys, setSelectedPermKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [roleList, permList] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(roleList);
      setPermissions(permList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openEdit = (role: Role) => {
    setEditRole(role);
    setSelectedPermKeys(new Set(role.permissions?.map(p => p.key) ?? []));
    setSaveMsg('');
  };

  const closeModal = () => {
    setEditRole(null);
    setSaveMsg('');
  };

  const togglePerm = (key: string) => {
    setSelectedPermKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!editRole) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await updateRolePermissions(editRole.id, Array.from(selectedPermKeys));
      setSaveMsg(t('saved'));
      void loadData();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const permByModule = MODULES.reduce((acc, mod) => {
    acc[mod] = permissions.filter(p => p.module === mod);
    return acc;
  }, {} as Record<string, Permission[]>);

  const permLabel = (p: Permission) => p.key; // already in module.action format

  const canEdit = can('role.update');

  return (
    <div className="page active role-mgmt-page">
      <div className="page-header role-mgmt-header">
        <div className="role-mgmt-title-wrap">
          <h1 className="page-title">{t('pRoleManagement')}</h1>
        </div>
      </div>
      <div className="card role-card">
        {error && <div className="user-error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>{error}</span></div>}
        <Table
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'code', label: t('roleCode'), render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700 }}>{r.code}</span> },
            { key: 'name', label: t('roleName') },
            {
              key: 'name',
              label: t('description'),
              render: (r) => <span className="role-desc-text">{getRoleDescription(r.code, appLang as 'zh' | 'vi' | 'en')}</span>,
            },
            { key: 'isSystem', label: 'System', render: (r) => r.isSystem ? <span style={{ color: 'var(--color-success)' }}>✓</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
            {
              key: '__actions__',
              label: t('actions'),
              render: (r) => {
                if (r.code === 'SUPER_ADMIN') {
                  return <span className="admin-locked-text">🔒 {t('locked')}</span>;
                }
                if (!canEdit) {
                  return <span className="no-perm-text">{t('noPermission')}</span>;
                }
                return (
                  <button
                    className="btn-outline btn-xs"
                    onClick={() => openEdit(r)}
                  >
                    {t('edit')}
                  </button>
                );
              },
            },
          ]}
          data={roles.filter(r => !['MANAGER', 'EDITOR'].includes(r.code))}
          emptyText={loading ? '...' : t('search') + '...'}
        />
      </div>

      {editRole && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editRole.name} — {t('permissions')}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {saveMsg && <div className="form-info">{saveMsg}</div>}
              {MODULES.filter(mod => permByModule[mod]?.length > 0).map(mod => (
                <div key={mod} className="perm-module">
                  <div className="perm-module-header">
                    <span className="perm-module-name">{mod}</span>
                    <span className="perm-module-count">{permByModule[mod].length}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {permByModule[mod].map(p => (
                      <label
                        key={p.key}
                        className={`perm-chip ${selectedPermKeys.has(p.key) ? 'selected' : ''} ${editRole.code === 'SUPER_ADMIN' ? 'locked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermKeys.has(p.key)}
                          onChange={() => togglePerm(p.key)}
                          disabled={editRole.code === 'SUPER_ADMIN'}
                        />
                        <span className="perm-chip-label">{permLabel(p)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={closeModal}>{t('close')}</button>
              {editRole.code !== 'SUPER_ADMIN' && canEdit && (
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}