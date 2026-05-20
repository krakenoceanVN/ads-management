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
import { FALLBACK_PAGE, FEATURE_FLAGS, isPageEnabled } from './lib/featureFlags';
import { LoginPage } from './pages/Login';
import {
  BFF_AUTH_TOKEN_INVALID_EVENT,
  BFF_AUTH_TOKEN_STORAGE_KEY,
} from './lib/bffApi';

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

  const logout = React.useCallback(() => {
    window.localStorage.removeItem(BFF_AUTH_TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

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
  };

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <AppProvider>
      <MainContent onLogout={logout} />
    </AppProvider>
  );
}
