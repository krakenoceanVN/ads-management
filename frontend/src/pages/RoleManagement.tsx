import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import { getPermissions, getRoles, updateRolePermissions } from '../lib/bffApi';
import type { Permission, Role } from '../lib/bffTypes';

const MODULES = ['user', 'role', 'advertiser', 'adOrder', 'adId', 'media', 'dataEntry', 'report', 'settlement', 'auditLog', 'system'];

export function RoleManagement() {
  const { t, can } = useAppContext();
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
    <div className="page active">
      <div className="page-header">
        <h1 className="page-title">{t('pRoleManagement')}</h1>
      </div>
      <div className="card">
        {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
        <Table
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'code', label: t('roleCode') },
            { key: 'name', label: t('roleName') },
            { key: 'isSystem', label: 'System', render: (r) => r.isSystem ? '✓' : '—' },
            { key: '__count__', label: t('permissions'), render: () => null },
            {
              key: '__actions__',
              label: t('actions'),
              render: (r) => (
                <button
                  className="btn-outline btn-xs"
                  onClick={() => openEdit(r)}
                  disabled={r.code === 'SUPER_ADMIN' || !canEdit}
                >
                  {t('edit')}
                </button>
              ),
            },
          ]}
          data={roles}
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
              {saveMsg && <div className="form-info" style={{ marginBottom: '8px' }}>{saveMsg}</div>}
              {MODULES.filter(mod => permByModule[mod]?.length > 0).map(mod => (
                <div key={mod} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '6px', textTransform: 'capitalize' }}>{mod}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {permByModule[mod].map(p => (
                      <label
                        key={p.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          cursor: editRole.code === 'SUPER_ADMIN' ? 'not-allowed' : 'pointer',
                          opacity: editRole.code === 'SUPER_ADMIN' ? 0.5 : 1,
                          background: selectedPermKeys.has(p.key) ? 'var(--primary-btn)' : 'transparent',
                          color: selectedPermKeys.has(p.key) ? '#fff' : 'inherit',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermKeys.has(p.key)}
                          onChange={() => togglePerm(p.key)}
                          disabled={editRole.code === 'SUPER_ADMIN'}
                        />
                        <span style={{ fontSize: '12px' }}>{permLabel(p)}</span>
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