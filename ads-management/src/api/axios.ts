import axios from 'axios'
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
    return Promise.reject(error)
  }
)

export function getUser(): User | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null

  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function isAdmin(): boolean {
  return getUser()?.perm_admin === true
}

export function isViewer(): boolean {
  return getUser()?.role === 'VIEWER'
}

export function canInputData(): boolean {
  const user = getUser()
  if (!user) return false
  return user.perm_admin === true || user.perm_data_input === true
}

export function canConfirmInput(): boolean {
  const user = getUser()
  if (!user) return false
  return user.perm_admin === true || user.perm_data_confirm === true
}

export function canViewDashboard(): boolean {
  return getUser() !== null
}

export function canAccessSiteList(): boolean {
  return getUser() !== null
}

export default api
