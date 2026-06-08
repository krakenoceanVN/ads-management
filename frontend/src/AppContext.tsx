import React, { createContext, useContext, useState, useEffect } from 'react';
import { initialDb, i18n } from './lib/data';
import { displayName as localizeName, renderOperationLog, type Lang, type OperationLog } from './lib/i18n';
import { getAuthToken, BFF_AUTH_TOKEN_CHANGED_EVENT, getCurrentUser } from './lib/bffApi';
import type { UserRole } from './lib/bffTypes';

type DetailPresetFilter = {
  ownerId: string;
  adTypeCode: string;
} | null;

type ModalState = {
  type: string;
  record?: any;
} | null;

interface CurrentUserInfo {
  id: number;
  username: string;
  role: UserRole;
  roleId?: number;
  roleCode?: string;
  roleName?: string;
  permissions?: string[];
  perm_data_input: boolean;
  perm_data_confirm: boolean;
  perm_admin: boolean;
}

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  currentPage: string;
  setCurrentPage: (p: string) => void;
  db: typeof initialDb;
  setDb: React.Dispatch<React.SetStateAction<typeof initialDb>>;
  t: (key: string) => string;
  modal: string | null;
  modalRecord: any;
  modalMode: 'create' | 'edit';
  openModal: (type: string, record?: any) => void;
  closeModal: () => void;
  displayName: (value: string | number | undefined | null) => string;
  renderLog: (log: OperationLog) => string;
  adIdPresetFilter: DetailPresetFilter;
  mediaIdPresetFilter: DetailPresetFilter;
  navigateToAdIds: (advId: number, adTypeCode: string) => void;
  navigateToMediaIds: (mediaId: number, adTypeCode: string) => void;
  clearAdIdPresetFilter: () => void;
  clearMediaIdPresetFilter: () => void;
  currentUser: CurrentUserInfo | null;
  setCurrentUser: (user: CurrentUserInfo | null) => void;
  can: (permissionKey: string) => boolean;
}

const AppContext = createContext<AppState | null>(null);

function getUserFromToken(): CurrentUserInfo | null {
  try {
    const token = getAuthToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.id) return null;
    return {
      id: payload.id,
      username: payload.username || '',
      role: payload.role || 'VIEWER',
      roleId: payload.roleId,
      roleCode: payload.roleCode,
      roleName: payload.roleName,
      permissions: payload.permissions || [],
      perm_data_input: payload.perm_data_input ?? false,
      perm_data_confirm: payload.perm_data_confirm ?? false,
      perm_admin: payload.perm_admin ?? false,
    };
  } catch {
    return null;
  }
}

interface AppProviderProps {
  children: React.ReactNode;
  initialCurrentUser?: CurrentUserInfo | null;
}

export function AppProvider({ children, initialCurrentUser }: AppProviderProps) {
  const [lang, setLang] = useState<Lang>('zh');
  const [currentPage, setCurrentPage] = useState('pAdvertiserList');
  const [db, setDb] = useState(initialDb);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [adIdPresetFilter, setAdIdPresetFilter] = useState<DetailPresetFilter>(null);
  const [mediaIdPresetFilter, setMediaIdPresetFilter] = useState<DetailPresetFilter>(null);
  const [currentUser, setCurrentUserState] = useState<CurrentUserInfo | null>(
    initialCurrentUser ?? getUserFromToken()
  );

  // Sync initialCurrentUser prop → state (runs when App.tsx resolves /api/auth/me)
  useEffect(() => {
    if (initialCurrentUser != null) {
      setCurrentUserState(initialCurrentUser);
    }
  }, [initialCurrentUser]);

  const t = (key: string) => {
    return (i18n[lang] as any)[key] || key;
  };

  const displayName = (value: string | number | undefined | null) => localizeName(value, lang);
  const renderLog = (log: OperationLog) => renderOperationLog(log, lang);

  const navigateToAdIds = (advId: number, adTypeCode: string) => {
    setAdIdPresetFilter({ ownerId: String(advId), adTypeCode });
    setCurrentPage('pAdIdMgmt');
  };

  const navigateToMediaIds = (mediaId: number, adTypeCode: string) => {
    setMediaIdPresetFilter({ ownerId: String(mediaId), adTypeCode });
    setCurrentPage('pMediaIdMgmt');
  };

  // Sync with token-changed events (fallback token decode)
  useEffect(() => {
    const handler = () => {
      // Only update from token if we don't have a server-fetched user
      if (!currentUser) {
        setCurrentUserState(getUserFromToken());
      }
    };
    window.addEventListener(BFF_AUTH_TOKEN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(BFF_AUTH_TOKEN_CHANGED_EVENT, handler);
  }, [currentUser]);

  const setCurrentUser = (user: CurrentUserInfo | null) => {
    setCurrentUserState(user);
  };

  // Legacy fallback can() — respects both RBAC permissions AND legacy boolean flags
  const can = (permissionKey: string): boolean => {
    if (!currentUser) return false;

    // SUPER_ADMIN always has all permissions
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.roleCode === 'SUPER_ADMIN') return true;

    // RBAC permission check
    if (currentUser.permissions?.includes(permissionKey)) return true;

    // Legacy fallback: ADMIN role gets everything
    if (currentUser.role === 'ADMIN' || currentUser.perm_admin) {
      // Legacy admin gets all except system.config
      if (permissionKey === 'system.config') return false;
      return true;
    }

    // Legacy perm_data_input gives dataEntry.read + dataEntry.create
    if (currentUser.perm_data_input) {
      if (permissionKey === 'dataEntry.read' || permissionKey === 'dataEntry.create') return true;
    }

    // Legacy perm_data_confirm gives dataEntry.confirm
    if (currentUser.perm_data_confirm) {
      if (permissionKey === 'dataEntry.confirm') return true;
    }

    // VIEWER has no write permissions (handled above — RBAC returns false for VIEWER)
    return false;
  };

  return (
    <AppContext.Provider value={{
      lang,
      setLang,
      currentPage,
      setCurrentPage,
      db,
      setDb,
      t,
      modal: modalState?.type || null,
      modalRecord: modalState?.record || null,
      modalMode: modalState?.record ? 'edit' : 'create',
      openModal: (type, record) => setModalState({ type, record }),
      closeModal: () => setModalState(null),
      displayName,
      renderLog,
      adIdPresetFilter,
      mediaIdPresetFilter,
      navigateToAdIds,
      navigateToMediaIds,
      clearAdIdPresetFilter: () => setAdIdPresetFilter(null),
      clearMediaIdPresetFilter: () => setMediaIdPresetFilter(null),
      currentUser,
      setCurrentUser,
      can,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('Missing AppProvider');
  return ctx;
};