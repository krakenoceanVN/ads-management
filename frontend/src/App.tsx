import React from 'react';
import { AppProvider, useAppContext } from './AppContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MediaMgmt, MediaAdOrderMgmt, MediaIdMgmt } from './pages/Media';
import { AiEntry, AdvEntry, MediaDataMgmt } from './pages/DataEntry';
import { AdvertiserList, AdOrderMgmt, AdIdMgmt } from './pages/Advertiser';
import { TotalProfit, OrderProfit, AdvQuery, MediaQuery } from './pages/Reports';
import { AdvSettlement, MediaSettlement } from './pages/Settlement';
import { OpLog } from './pages/System';
import { UserManagement } from './pages/UserManagement';
import { RoleManagement } from './pages/RoleManagement';
import { FALLBACK_PAGE, FEATURE_FLAGS, isPageEnabled } from './lib/featureFlags';
import { LoginPage } from './pages/Login';
import {
  BFF_AUTH_TOKEN_CHANGED_EVENT,
  BFF_AUTH_TOKEN_INVALID_EVENT,
  BFF_AUTH_TOKEN_STORAGE_KEY,
  getCurrentUser,
  clearAuthToken,
} from './lib/bffApi';
import type { UserRole } from './lib/bffTypes';

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

function MainContent({ onLogout }: { onLogout: () => void }) {
  const { currentPage, setCurrentPage } = useAppContext();

  React.useEffect(() => {
    if (!isPageEnabled(currentPage)) setCurrentPage(FALLBACK_PAGE);
  }, [currentPage, setCurrentPage]);

  const renderPage = () => {
    const pageKey = isPageEnabled(currentPage) ? currentPage : FALLBACK_PAGE;
    switch (pageKey) {
      case 'pAdvertiserList': return <AdvertiserList />;
      case 'pAdOrderMgmt': return <AdOrderMgmt />;
      case 'pAdIdMgmt': return <AdIdMgmt />;
      case 'pMediaMgmt': return <MediaMgmt />;
      case 'pMediaAdOrderMgmt': return <MediaAdOrderMgmt />;
      case 'pMediaIdMgmt': return <MediaIdMgmt />;
      case 'pAiEntry': return <AiEntry />;
      case 'pAdvEntry': return <AdvEntry />;
      case 'pMediaDataMgmt': return <MediaDataMgmt />;
      case 'pTotalProfit': return <TotalProfit />;
      case 'pOrderProfit': return <OrderProfit />;
      case 'pAdvQuery': return <AdvQuery />;
      case 'pMediaQuery': return <MediaQuery />;
      case 'pAdvSettlement': return FEATURE_FLAGS.settlement ? <AdvSettlement /> : <AdvertiserList />;
      case 'pMediaSettlement': return FEATURE_FLAGS.settlement ? <MediaSettlement /> : <AdvertiserList />;
      case 'mOpLog': return <OpLog />;
      case 'pUserManagement': return <UserManagement />;
      case 'pRoleManagement': return <RoleManagement />;
      default: return <div className="empty-state"><div className="empty-state-icon">🚧</div><div className="empty-state-text">{currentPage}</div></div>;
    }
  };

  return (
    <div id="layout">
      <Sidebar />
      <div id="main">
        <Topbar onLogout={onLogout} />
        <div id="content">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = React.useState(() => window.localStorage.getItem(BFF_AUTH_TOKEN_STORAGE_KEY));
  const [initialCurrentUser, setInitialCurrentUser] = React.useState<CurrentUserInfo | null>(null);

  const logout = React.useCallback(() => {
    clearAuthToken();
    setToken(null);
    setInitialCurrentUser(null);
  }, []);

  // Fetch currentUser from /api/auth/me when token is available
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getCurrentUser()
      .then(user => {
        if (!cancelled) setInitialCurrentUser(user as unknown as CurrentUserInfo);
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => { cancelled = true; };
  }, [token, logout]);

  React.useEffect(() => {
    const syncToken = (event: StorageEvent) => {
      if (event.key === BFF_AUTH_TOKEN_STORAGE_KEY) setToken(event.newValue);
    };
    window.addEventListener('storage', syncToken);
    window.addEventListener(BFF_AUTH_TOKEN_INVALID_EVENT, logout);
    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener(BFF_AUTH_TOKEN_INVALID_EVENT, logout);
    };
  }, [logout]);

  const handleLogin = (nextToken: string) => {
    window.localStorage.setItem(BFF_AUTH_TOKEN_STORAGE_KEY, nextToken);
    setToken(nextToken);
    window.dispatchEvent(new Event(BFF_AUTH_TOKEN_CHANGED_EVENT));
  };

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <AppProvider initialCurrentUser={initialCurrentUser}>
      <MainContent onLogout={logout} />
    </AppProvider>
  );
}