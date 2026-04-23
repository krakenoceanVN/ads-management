import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Menu, Button, Space, Tooltip } from 'antd'
import {
  ApartmentOutlined,
  BarChartOutlined,
  DashboardOutlined,
  FormOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
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

function getCurrentMenuKey(pathname: string): string {
  if (pathname.startsWith('/downstream')) return 'downstream-menu'
  if (pathname.startsWith('/admin')) return 'admin'
  return AD_TYPE_MENU_KEY_MAP[pathname] ?? 'input-sm'
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

  useEffect(() => {
    localStorage.setItem('ads-sider-width', JSON.stringify(sidebarWidth))
  }, [sidebarWidth])

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

  const menuText = (label: string) => (
    <span className="menu-item-text" title={label}>
      {label}
    </span>
  )

  const buildAdTypeItems = (
    prefix: 'dash' | 'input' | 'up',
    getPath: (segment: 'sm' | '360' | 'baidu' | 'other') => string,
  ): NonNullable<MenuProps['items']> => [
    {
      key: `${prefix}-sm`,
      label: menuText(t('adType.sm')),
      onClick: () => navigate(getPath('sm')),
    },
    {
      key: `${prefix}-360`,
      label: menuText(t('adType.360')),
      onClick: () => navigate(getPath('360')),
    },
    {
      key: `${prefix}-baidu`,
      label: menuText(t('adType.baidu')),
      onClick: () => navigate(getPath('baidu')),
    },
    {
      key: `${prefix}-other`,
      label: menuText(t('adType.other')),
      onClick: () => navigate(getPath('other')),
    },
  ]

  const currentMenuKey = getCurrentMenuKey(location.pathname)
  const themeButtonIcon = mode === 'light' ? <SunOutlined /> : <MoonOutlined />
  const themeButtonLabel = mode === 'light' ? t('theme.light') : t('theme.dark')

  const menuItems: MenuProps['items'] = [
    ...(canViewDashboard()
      ? [{
          key: 'dashboard',
          icon: <DashboardOutlined />,
          label: menuText(t('nav.dashboard')),
          children: buildAdTypeItems('dash', (segment) => `/dashboard/${segment}`),
        }]
      : []),
    {
      key: 'input',
      icon: <FormOutlined />,
      label: menuText(t('nav.input')),
      children: [
        ...buildAdTypeItems('input', (segment) => `/input/${segment}`),
        {
          key: 'input-yiyi',
          label: menuText(t('adType.yiyi')),
          onClick: () => navigate('/input/yiyi'),
        },
      ],
    },
    {
      key: 'upstream',
      icon: <BarChartOutlined />,
      label: menuText(t('nav.upstream')),
      children: buildAdTypeItems('up', (segment) => `/upstream/${segment}`),
    },
    {
      key: 'downstream-menu',
      icon: <ApartmentOutlined />,
      label: menuText(t('nav.downstream')),
      onClick: () => navigate('/downstream'),
    },
    ...(canAccessSiteList()
      ? [{
          key: 'admin',
          icon: <SettingOutlined />,
          label: menuText(t('nav.siteList')),
          onClick: () => navigate('/admin'),
        }]
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

  const pageTitle = (() => {
    if (location.pathname.startsWith('/dashboard')) {
      return adTypeTitle
        ? `${t('nav.dashboard')} - ${adTypeTitle}`
        : t('nav.dashboard')
    }

    if (location.pathname.startsWith('/input')) {
      if (location.pathname === '/input/yiyi') {
        return t('yiyi.title')
      }

      return adTypeTitle
        ? `${t('nav.input')} - ${adTypeTitle}`
        : t('nav.input')
    }

    if (location.pathname.startsWith('/upstream')) {
      return adTypeTitle
        ? `${t('nav.upstream')} - ${adTypeTitle}`
        : t('nav.upstream')
    }

    if (location.pathname.startsWith('/admin')) return t('nav.siteList')
    if (location.pathname.startsWith('/downstream')) return t('nav.downstream')
    return t('app.brand')
  })()

  const pageIcon = (() => {
    if (location.pathname.startsWith('/dashboard')) return <DashboardOutlined />
    if (location.pathname.startsWith('/input')) return <FormOutlined />
    if (location.pathname.startsWith('/upstream')) return <BarChartOutlined />
    if (location.pathname.startsWith('/admin')) return <SettingOutlined />
    if (location.pathname.startsWith('/downstream')) return <ApartmentOutlined />
    return <DashboardOutlined />
  })()

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
          {!collapsed ? (
            <span className="sider-brand-text" title={t('app.brand')}>
              {t('app.brand')}
            </span>
          ) : null}
        </div>

        <Menu
          theme={mode === 'light' ? 'light' : 'dark'}
          mode="inline"
          selectedKeys={[currentMenuKey]}
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
          aria-label={t('layout.resizeSidebar')}
        />
      </Sider>

      <Layout className="app-main-layout">
        <Header className="app-topbar">
          <div className="app-topbar-left">
            <span className="app-page-icon">{pageIcon}</span>
            <h2 className="app-page-title" title={pageTitle}>
              {pageTitle}
            </h2>
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

            <Button
              type="text"
              icon={<LogoutOutlined />}
              className="app-logout-btn"
              onClick={handleLogout}
            >
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
