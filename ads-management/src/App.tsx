import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DailyInputPage from './pages/DailyInputPage'
import DashboardPage from './pages/DashboardPage'
import UpstreamDashboardPage from './pages/UpstreamDashboardPage'
import DownstreamPage from './pages/DownstreamPage'
import DownstreamSitesPage from './pages/DownstreamSitesPage'
import AdminPage from './pages/AdminPage'
import YiyiInputPage from './pages/YiyiInputPage'
import ErrorBoundary from './components/common/ErrorBoundary'
import { ThemeProvider } from './theme/ThemeProvider'
import { canAccessSiteList, canViewDashboard } from './api/axios'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AppHomeRedirect() {
  return <Navigate to={canViewDashboard() ? '/dashboard/sm' : '/input/sm'} replace />
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  if (!canViewDashboard()) {
    return <Navigate to="/input/sm" replace />
  }
  return children
}

function SiteListRoute({ children }: { children: React.ReactNode }) {
  if (!canAccessSiteList()) {
    return <Navigate to="/input/sm" replace />
  }
  return children
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AppHomeRedirect />} />
            <Route path="dashboard/sm" element={<AdminOnlyRoute><DashboardPage adType="SM" /></AdminOnlyRoute>} />
            <Route path="dashboard/360" element={<AdminOnlyRoute><DashboardPage adType="360" /></AdminOnlyRoute>} />
            <Route path="dashboard/baidu" element={<AdminOnlyRoute><DashboardPage adType="BAIDU_JS" /></AdminOnlyRoute>} />
            <Route path="dashboard/other" element={<AdminOnlyRoute><DashboardPage adType="OTHER" /></AdminOnlyRoute>} />
            <Route path="input/sm" element={<DailyInputPage adType="SM" />} />
            <Route path="input/360" element={<DailyInputPage adType="360" />} />
            <Route path="input/baidu" element={<DailyInputPage adType="BAIDU_JS" />} />
            <Route path="input/other" element={<DailyInputPage adType="OTHER" />} />
            <Route path="input/yiyi" element={<YiyiInputPage />} />
            <Route path="admin" element={<SiteListRoute><AdminPage /></SiteListRoute>} />
            <Route path="downstream" element={<DownstreamPage />} />
            <Route path="downstream/:id" element={<DownstreamSitesPage />} />
            <Route path="upstream" element={<UpstreamDashboardPage />} />
            <Route path="upstream/sm" element={<UpstreamDashboardPage adType="SM" />} />
            <Route path="upstream/360" element={<UpstreamDashboardPage adType="360" />} />
            <Route path="upstream/baidu" element={<UpstreamDashboardPage adType="BAIDU_JS" />} />
            <Route path="upstream/other" element={<UpstreamDashboardPage adType="OTHER" />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
