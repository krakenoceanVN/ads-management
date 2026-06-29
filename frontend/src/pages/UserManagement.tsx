import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../AppContext';
import { Table } from '../components/Table';
import {
  createUser,
  getRoles,
  getUsers,
  resetUserPassword,
  updateUser,
} from '../lib/bffApi';
import type { Role, UserManagementUser, CreateUserInput, UpdateUserInput } from '../lib/bffTypes';

type ModalMode = 'create' | 'edit' | 'resetPw' | null;

async function disableUser(userId: string): Promise<void> {
  await updateUser(userId, { status: 'inactive' });
}

function ModalPortal({ children }: { children: React.ReactNode }) {
  const container = React.useRef<HTMLDivElement | null>(null);
  if (!container.current) container.current = document.createElement('div');
  useEffect(() => {
    const cont = container.current!;
    document.body.appendChild(cont);
    return () => {
      if (cont.parentNode === document.body) document.body.removeChild(cont);
    };
  }, []);
  return ReactDOM.createPortal(children, container.current);
}

function formatCreatedAt(value: string | null | undefined) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function UserManagement() {
  const { t, can, currentUser } = useAppContext();
  const [rows, setRows] = useState<UserManagementUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editUser, setEditUser] = useState<UserManagementUser | null>(null);
  const [formData, setFormData] = useState<CreateUserInput & { password2?: string }>({
    username: '',
    password: '',
    password2: '',
    roleId: '',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [users, roleList] = await Promise.all([getUsers(), getRoles()]);
      setRows(users);
      setRoles(roleList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const closeModal = () => {
    setModalMode(null);
    setEditUser(null);
    setFormError('');
  };

  const openCreate = () => {
    setFormData({ username: '', password: '', password2: '', roleId: roles[0]?.id ?? '', status: 'active' });
    setFormError('');
    setModalMode('create');
  };

  const openEdit = (user: UserManagementUser) => {
    setEditUser(user);
    setFormData({ username: user.username, password: '', password2: '', roleId: user.roleId, status: user.status as 'active' | 'inactive' });
    setFormError('');
    setModalMode('edit');
  };

  const openResetPw = (user: UserManagementUser) => {
    setEditUser(user);
    setFormData({ username: user.username, password: '', password2: '', roleId: user.roleId });
    setFormError('');
    setModalMode('resetPw');
  };

  const handleSave = async () => {
    setFormError('');
    if (!formData.username.trim()) { setFormError(t('username') + ' required'); return; }
    if (modalMode === 'create' && formData.password.length < 8) { setFormError('Password min 8 chars'); return; }
    if (modalMode !== 'create' && formData.password && formData.password.length < 8) { setFormError('Password min 8 chars'); return; }
    if (modalMode === 'resetPw') {
      if (formData.password.length < 8) { setFormError('Password min 8 chars'); return; }
      setSaving(true);
      try {
        await resetUserPassword(editUser!.id, { password: formData.password });
        closeModal();
        void loadUsers();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to reset password');
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      const updateData: UpdateUserInput = {};
      if (formData.roleId) updateData.roleId = formData.roleId;
      if (formData.status) updateData.status = formData.status;
      if (formData.password) updateData.password = formData.password;

      if (modalMode === 'create') {
        await createUser({ username: formData.username, password: formData.password, roleId: formData.roleId, status: formData.status });
      } else {
        await updateUser(editUser!.id, updateData);
      }
      closeModal();
      void loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => (
    <span className={`status-badge ${status === 'active' ? 'active' : 'inactive'}`}>{t(status)}</span>
  );

  const canCreate = can('user.create');
  const canEdit = can('user.update');
  const canResetPw = can('user.resetPassword');
  const canDisable = can('user.disable');

  const modalTitle = modalMode === 'create' ? t('createUser') : modalMode === 'edit' ? t('editUser') : t('resetPassword');

  return (
    <div className="page active">
      <div className="page-header">
        <h1 className="page-title">{t('pUserManagement')}</h1>
        {canCreate && (
          <button className="btn-primary btn-sm" onClick={openCreate}>{t('new')}</button>
        )}
      </div>
      <div className="card">
        {error && <div className="form-error" style={{ margin: '8px 0' }}>{error}</div>}
        <Table
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'username', label: t('username') },
            { key: 'roleName', label: t('role') },
            { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
            { key: 'created_at', label: t('createdAt'), render: (r) => formatCreatedAt(r.created_at) },
            {
              key: '__actions__',
              label: t('actions'),
              render: (r) => {
                const isSelf = r.id === currentUser?.id;
                if (!canEdit && !canResetPw && !canDisable) {
                  return <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>{t('noPermission')}</span>;
                }
                return (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {canEdit && <button className="btn-outline btn-xs" onClick={() => openEdit(r)}>{t('edit')}</button>}
                    {canResetPw && <button className="btn-outline btn-xs" onClick={() => openResetPw(r)}>{t('resetPassword')}</button>}
                    {canDisable && r.status === 'active' && !isSelf && (
                      <button
                        className="btn-outline btn-xs"
                        style={{ color: 'var(--danger)' }}
                        onClick={async () => {
                          if (!window.confirm(t('confirmDisable') + '?')) return;
                          setSaving(true);
                          try {
                            await disableUser(r.id);
                            void loadUsers();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : t('errorOccurred'));
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >{t('disable')}</button>
                    )}
                    {canDisable && r.status === 'active' && isSelf && (
                      <span style={{ color: 'var(--text-sub)', fontSize: '11px' }}>{t('cannotDisableSelf')}</span>
                    )}
                  </div>
                );
              },
            },
          ]}
          data={rows}
          emptyText={loading ? '...' : t('search') + '...'}
        />
      </div>

      {modalMode && (
        <ModalPortal>
          <div className="modal-overlay open" onClick={closeModal}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{modalTitle}</h3>
                <button className="modal-close" onClick={closeModal}>×</button>
              </div>
              <div className="modal-body">
                {formError && <div className="form-error" style={{ marginBottom: '8px' }}>{formError}</div>}
                <div className="form-group">
                  <label>{t('username')}</label>
                  <input
                    className="form-input"
                    value={formData.username}
                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    disabled={modalMode !== 'create'}
                    placeholder={t('username')}
                  />
                </div>
                {modalMode !== 'edit' && (
                  <div className="form-group">
                    <label>{t('password')}</label>
                    <input
                      className="form-input"
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={modalMode === 'create' ? t('password') : t('newPassword')}
                    />
                  </div>
                )}
                {modalMode === 'edit' && (
                  <div className="form-group">
                    <label>{t('password')}</label>
                    <input
                      className="form-input"
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={t('newPassword') + ' (' + t('optional') + ')'}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>{t('role')}</label>
                  <select
                    className="form-select"
                    value={formData.roleId}
                    onChange={e => setFormData(prev => ({ ...prev, roleId: e.target.value }))}
                  >
                    {roles.filter(r => !['MANAGER', 'EDITOR'].includes(r.code)).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                {modalMode !== 'resetPw' && (
                  <div className="form-group">
                    <label>{t('status')}</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    >
                      <option value="active">{t('active')}</option>
                      <option value="inactive">{t('inactive')}</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-outline" onClick={closeModal}>{t('cancel')}</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}