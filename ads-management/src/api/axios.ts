import axios from 'axios'
import { message } from 'antd'
import type { User } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401 → clear token & redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    if (error.response?.status === 403) {
      message.error('Bạn không có quyền thực hiện thao tác này')
    }
    return Promise.reject(error)
  }
)

export function getStoredUser(): User | null {
  const user = localStorage.getItem('user')
  if (!user) return null
  try {
    return JSON.parse(user) as User
  } catch {
    return null
  }
}

export function isAdmin(): boolean {
  const user = getStoredUser()
  return user?.role === 'ADMIN' || user?.perm_admin === true
}

export function isViewer(): boolean {
  return getStoredUser()?.role === 'VIEWER'
}

export function canInputData(): boolean {
  const user = getStoredUser()
  if (!user || user.role === 'VIEWER') return false
  return user.perm_admin === true || user.perm_data_input === true
}

export function canConfirmInput(): boolean {
  const user = getStoredUser()
  if (!user || user.role === 'VIEWER') return false
  return user.perm_admin === true || user.perm_data_confirm === true
}

export function canViewDashboard(): boolean {
  return getStoredUser() !== null
}

export function canAccessSiteList(): boolean {
  return getStoredUser() !== null
}

export default api
