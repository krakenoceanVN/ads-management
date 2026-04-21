import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Space, Tooltip } from 'antd'
import {
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import brandLogoLightImage from '../../assets/trang-khong-logo.png'
import brandLogoDarkImage from '../../assets/den-khong-logo.png'
import { canAccessSiteList, canViewDashboard, getUser } from '../../api/axios'
import LanguageSwitcher from '../common/LanguageSwitcher'
import { useThemeMode } from '../../theme/themeModeContext'

const { Sider, Header, Content } = Layout
const DEFAULT_SIDER_WIDTH = 220
const MIN_SIDER_WIDTH = 180
const MAX_SIDER_WIDTH = 420

const AD_TYPE_MENU_KEY_MAP: Record<string, string> = {
  '/dashboard/sm': 'dash-sm',
  '/dashboard/360': 'dash-360',
  '/dashboard/baidu': 'dash-baidu',
  '/dashboard/other': 'dash-other',
  '/input/sm': 'input-sm',
  '/input/360': 'input-360',
  '/input/baidu': 'input-baidu',
  '/input/other': 'input-other',
  '/upstream/sm': 'up-sm',
  '/upstream/360': 'up-360',
  '/upstream/baidu': 'up-baidu',
  '/upstream/other': 'up-other',
  '/input/yiyi': 'input-yiyi',
}

export default function AppLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const user = getUser()
  const { mode, cycleMode } = useThemeMode()
  const brandLogoImage = mode === 'light' ? brandLogoLightImage : brandLogoDarkImage
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('ads-sider-width')
      return saved ? Number(JSON.parse(saved)) : DEFAULT_SIDER_WIDTH
    } catch {
      return DEFAULT_SIDER_WIDTH
    }
  })
  const [isResizing, setIsResizing] = useState(false)
  const isContrastMode = mode === 'contrast-soft'

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem('ads-sider-width', JSON.stringify(sidebarWidth))
  }, [sidebarWidth])

  // Theme shortcut: Alt+Shift+T
  useEffect(() => {
    const handleThemeShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        cycleMode()
      }
    }
    window.addEventListener('keydown', handleThemeShortcut)
    return () => window.removeEventListener('keydown', handleThemeShortcut)
  }, [cycleMode])

  const currentAdType =
    AD_TYPE_MENU_KEY_MAP[location.pathname] ??
    (location.pathname.startsWith('/downstream')
      ? 'downstream-menu'
      : location.pathname.startsWith('/admin')
        ? 'admin'
        : location.pathname.startsWith('/upstream')
          ? 'up-sm'
          : 'input-sm')

  const menuLabel = (emoji: string, label: string) => (
    <span className="menu-item-label">
      <span className="menu-item-emoji">{emoji}</span>
      <span className="menu-item-text" title={label}>{label}</span>
    </span>
  )

  const menuText = (label: string) => (
    <span className="menu-item-text" title={label}>{label}</span>
  )

  const rootIcon = (emoji: string) => (
    <span className="menu-root-icon" aria-hidden>
      {emoji}
    </span>
  )

  const dashboardItems: MenuProps['items'] = [
    { key: 'dash-sm', label: menuLabel('•', t('adType.sm')), onClick: () => navigate('/dashboard/sm') },
    { key: 'dash-360', label: menuLabel('•', t('adType.360')), onClick: () => navigate('/dashboard/360') },
    { key: 'dash-baidu', label: menuLabel('•', t('adType.baidu')), onClick: () => navigate('/dashboard/baidu') },
    { key: 'dash-other', label: menuLabel('•', t('adType.other')), onClick: () => navigate('/dashboard/other') },
  ]

  const inputItems: MenuProps['items'] = [
    { key: 'input-sm', label: menuLabel('•', t('adType.sm')), onClick: () => navigate('/input/sm') },
    { key: 'input-360', label: menuLabel('•', t('adType.360')), onClick: () => navigate('/input/360') },
    { key: 'input-baidu', label: menuLabel('•', t('adType.baidu')), onClick: () => navigate('/input/baidu') },
    { key: 'input-other', label: menuLabel('•', t('adType.other')), onClick: () => navigate('/input/other') },
    { key: 'input-yiyi', label: menuLabel('•', t('adType.yiyi')), onClick: () => navigate('/input/yiyi') },
  ]

  const upstreamItems: MenuProps['items'] = [
    { key: 'up-sm', label: menuLabel('•', t('adType.sm')), onClick: () => navigate('/upstream/sm') },
    { key: 'up-360', label: menuLabel('•', t('adType.360')), onClick: () => navigate('/upstream/360') },
    { key: 'up-baidu', label: menuLabel('•', t('adType.baidu')), onClick: () => navigate('/upstream/baidu') },
    { key: 'up-other', label: menuLabel('•', t('adType.other')), onClick: () => navigate('/upstream/other') },
  ]

  const menuItems: MenuProps['items'] = [
    ...(canViewDashboard()
      ? [
          {
            key: 'dashboard',
            icon: rootIcon('📊'),
            label: menuText(t('nav.dashboard')),
            children: dashboardItems,
          },
        ]
      : []),
    {
      key: 'input',
      icon: rootIcon('📝'),
      label: menuText(t('nav.input')),
      children: inputItems,
    },
    {
      key: 'upstream',
      icon: rootIcon('📈'),
      label: menuText(t('nav.upstream')),
      children: upstreamItems,
    },
    {
      key: 'downstream-menu',
      icon: rootIcon('⬇️'),
      label: menuText(t('nav.downstream')),
      onClick: () => navigate('/downstream'),
    },
    ...(canAccessSiteList()
      ? [
          {
            key: 'admin',
            icon: rootIcon('⚙️'),
            label: menuText(t('nav.siteList')),
            onClick: () => navigate('/admin'),
          },
        ]
      : []),
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const getAdTypeTitle = () => {
    if (location.pathname.endsWith('/sm')) return t('adType.sm')
    if (location.pathname.endsWith('/360')) return t('adType.360')
    if (location.pathname.endsWith('/baidu')) return t('adType.baidu')
    if (location.pathname.endsWith('/other')) return t('adType.other')
    if (location.pathname.endsWith('/yiyi')) return t('adType.yiyi')
    return undefined
  }

  const adTypeTitle = getAdTypeTitle()

  const pageTitle =
    location.pathname.startsWith('/dashboard')
      ? adTypeTitle
        ? `${t('nav.dashboard')} - ${adTypeTitle}`
        : t('nav.dashboard')
      : location.pathname.startsWith('/input')
        ? adTypeTitle
          ? `${t('nav.input')} - ${adTypeTitle}`
          : t('nav.input')
        : location.pathname.startsWith('/upstream')
          ? adTypeTitle
            ? `${t('nav.upstream')} - ${adTypeTitle}`
            : t('nav.upstream')
          : location.pathname.startsWith('/admin')
            ? t('nav.siteList')
            : location.pathname.startsWith('/downstream')
              ? t('nav.downstream')
              : t('app.brand')

  const pageIcon =
    location.pathname.startsWith('/dashboard')
      ? '📊'
      : location.pathname.startsWith('/input')
        ? '📝'
        : location.pathname.startsWith('/upstream')
          ? '📈'
          : location.pathname.startsWith('/admin')
            ? '⚙️'
            : location.pathname.startsWith('/downstream')
              ? '⬇️'
              : '✨'

  // Resizable sidebar logic
  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (collapsed) setCollapsed(false)

    const startX = event.clientX
    const startWidth = collapsed ? DEFAULT_SIDER_WIDTH : sidebarWidth
    setIsResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        MAX_SIDER_WIDTH,
        Math.max(MIN_SIDER_WIDTH, startWidth + moveEvent.clientX - startX),
      )
      setSidebarWidth(nextWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const themeButtonIcon = mode === 'light' ? <SunOutlined /> : <MoonOutlined />
  const themeButtonLabel = mode === 'light' ? t('theme.light') : t('theme.dark')

  return (
    <Layout className="app-layout-shell">
      <Sider
        width={sidebarWidth}
        collapsedWidth={84}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className={isResizing ? 'app-sider is-resizing' : 'app-sider'}
        trigger={null}
      >
        <div className="sider-brand">
          <div className="sider-logo">
            <img src={brandLogoImage} alt={t('app.brand')} className="sider-logo-image" />
          </div>
          {!collapsed && <span className="sider-brand-text" title={t('app.brand')}>{t('app.brand')}</span>}
        </div>
        <Menu
          theme={mode === 'light' ? 'light' : 'dark'}
          mode="inline"
          selectedKeys={[currentAdType]}
          items={menuItems}
          className="app-menu"
        />
        <div className="sider-footer">
          <Button
            type="text"
            className="sider-toggle-btn"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((prev) => !prev)}
          />
        </div>
        <div
          className="sider-resizer"
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      </Sider>

      <Layout className="app-main-layout">
        <Header className="app-topbar">
          <div className="app-topbar-left">
            <span className="app-page-icon">{pageIcon}</span>
            <h2 className="app-page-title" title={pageTitle}>{pageTitle}</h2>
          </div>
          <Space size={14} className="app-topbar-actions">
            <div className={`app-theme-switcher ${isContrastMode ? 'is-contrast' : ''}`}>
              <Tooltip
                placement="bottom"
                title={`${t('theme.current')}: ${themeButtonLabel}. ${t('theme.cycleHint')}. ${t('theme.shortcut')}`}
              >
                <Button
                  type="text"
                  className={`app-theme-toggle-btn ${isContrastMode ? 'is-contrast' : ''}`}
                  icon={themeButtonIcon}
                  onClick={cycleMode}
                  title={`${themeButtonLabel} - ${t('theme.cycleHint')}`}
                  aria-label={`${themeButtonLabel} - ${t('theme.cycleHint')}`}
                />
              </Tooltip>
            </div>
            <LanguageSwitcher />
            <span className="app-user-pill" title={user?.username}>
              <UserOutlined />
              <span className="app-user-pill-text">{user?.username}</span>
            </span>
            <Button type="text" icon={<LogoutOutlined />} className="app-logout-btn" onClick={handleLogout}>
              {t('nav.logout')}
            </Button>
          </Space>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
