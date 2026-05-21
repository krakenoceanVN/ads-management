import React from 'react';
import { useAppContext } from '../AppContext';
import { FALLBACK_PAGE, isPageEnabled, visibleMenu } from '../lib/featureFlags';

export function Topbar({ onLogout }: { onLogout: () => void }) {
  const { lang, setLang, currentPage, t } = useAppContext();
  const displayPage = isPageEnabled(currentPage) ? currentPage : FALLBACK_PAGE;

  const getBreadcrumb = () => {
    const group = visibleMenu.find(g => g.children && g.children.some(c => c.key === displayPage));
    if (group) {
      return <><span className="text-gray-500">{t(group.key)}</span> / <strong>{t(displayPage)}</strong></>;
    }
    return <strong>{t(displayPage)}</strong>;
  };

  return (
    <header id="topbar">
      <div className="tb-breadcrumb">{getBreadcrumb()}</div>
      <div className="tb-right">
        <div className="lang-switcher">
          <button className={`lang-btn ${lang === 'zh' ? 'active' : ''}`} onClick={() => setLang('zh')}>中</button>
          <button className={`lang-btn ${lang === 'vi' ? 'active' : ''}`} onClick={() => setLang('vi')}>VI</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>
        <button className="btn-outline logout-btn" type="button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
