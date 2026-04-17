import axios from 'axios'

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

export function isAdmin(): boolean {
  const user = localStorage.getItem('user')
  if (!user) return false
  try {
    return (JSON.parse(user) as { perm_admin?: boolean }).perm_admin === true
  } catch {
    return false
  }
}

export function canConfirmInput(): boolean {
  const user = localStorage.getItem('user')
  if (!user) return false
  try {
    const parsed = JSON.parse(user) as { perm_admin?: boolean; perm_data_confirm?: boolean }
    return parsed.perm_admin === true || parsed.perm_data_confirm === true
  } catch {
    return false
  }
}

export default api
