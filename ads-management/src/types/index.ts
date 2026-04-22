export type AdTypeCode = 'SM' | '360' | 'BAIDU_JS' | 'OTHER'
export type BillingMethod = 'CPM' | 'RATIO'
export type InputStatus = 'unconfirmed' | 'confirmed'
export type UserRole = 'ADMIN' | 'EDITOR' | 'VIEWER'

export interface AdSite {
  id: number
  upstream_id?: number
  upstream_name: string
  name: string
  billing_method: BillingMethod
  current_unit_price?: number
  current_ratio?: number
  active_rebate_rate?: number
}

export interface AdSiteRebateRate {
  id: string
  ad_site_id: number
  rate: number
  start_date: string
  end_date?: string | null
  created_at: string
  updated_at: string
}

export interface DailyInputRow extends AdSite {
  existing_record: {
    id: number
    qty?: number
    amount1?: number
    amount2?: number
    unit_price_snapshot?: number
    ratio_snapshot?: number
    rebate_amount?: number
    rebate_rate_snapshot?: number
    actual_revenue?: number
    revenue: number
    status: InputStatus
  } | null
}

export interface SummaryRow {
  date: string
  revenue: number
  cost: number
  tax: number
  profit: number
  profit_rate: number
  upstream_breakdown: Record<string, number>
  upstream_detail_breakdown?: Record<string, {
    pv: number
    unit_price: number
    amount: number
  }>
  ml_payout: number
  le_payout?: number
  yiyi_payout?: number
}

export interface User {
  id: number
  username: string
  role: UserRole
  perm_data_input: boolean
  perm_data_confirm: boolean
  perm_admin: boolean
  status: string
  last_login_at?: string
  created_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
