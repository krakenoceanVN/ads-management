export type AdTypeCode = "SM" | "360" | "BAIDU_JS" | "OTHER"
export type BillingMethod = "CPM" | "RATIO"
export type InputStatus = "unconfirmed" | "confirmed"
export type DownstreamType = "ML" | "LE" | "YIYI"
export type UserStatus = "active" | "inactive"
export type UserRole = "ADMIN" | "EDITOR" | "VIEWER"
export type UpstreamStatus = "active" | "inactive"

// ============================================================
// ad_type
// ============================================================
export interface AdType {
  id: number
  code: AdTypeCode
  name: string
  created_at: Date
  updated_at: Date
}

// ============================================================
// upstream
// ============================================================
export interface Upstream {
  id: number
  ad_type_id: number
  name: string
  status: UpstreamStatus
  created_at: Date
  updated_at: Date
  // JOIN
  ad_type_code?: AdTypeCode
}

// ============================================================
// ad_site
// ============================================================
export interface AdSite {
  id: number
  upstream_id: number
  name: string
  billing_method: BillingMethod
  current_unit_price?: number   // SM: CPM billing
  current_ratio?: number        // 360/Baidu: RATIO billing
  status: UpstreamStatus
  created_at: Date
  updated_at: Date
  // JOIN
  upstream_name?: string
  ad_type_id?: number
  ad_type_code?: AdTypeCode
}

// ============================================================
// daily_input
// ============================================================
export interface DailyInputRecord {
  id?: number
  record_date: string
  ad_site_id: number
  qty?: number               // SM: CPM quantity
  unit_price_snapshot?: number // SM: CPM unit price at input time
  amount1?: number           // 360/Baidu: amount before ratio
  amount2?: number           // 360/Baidu: amount before ratio
  ratio_snapshot?: number     // 360/Baidu: ratio at input time
  revenue: number
  status: InputStatus
  note?: string
  created_by?: number
  created_at?: Date
  updated_at?: Date
}

// Extended row for UI table — joins ad_site info
export interface DailyInputRow extends AdSite {
  existing_record: DailyInputRecord | null
}

// ============================================================
// batch input (save multiple sites in one request)
// ============================================================
export interface BatchInputItem {
  ad_site_id: number
  qty?: number                  // CPM
  unit_price_override?: number  // override snapshot price
  amount1?: number              // RATIO
  amount2?: number              // RATIO
  ratio_override?: number       // RATIO - override stored ratio
}

export interface BatchInputPayload {
  record_date: string
  items: BatchInputItem[]
}

// ============================================================
// downstream
// ============================================================
export interface Downstream {
  id: number
  ad_type_id: number
  downstream_type: DownstreamType
  payout_rate: number   // ML always 0.8, etc.
  status: UserStatus
  created_at: Date
  updated_at: Date
}

export interface DownstreamPeriod {
  id: number
  downstream_id: number
  pct_hal: number       // tỷ lệ UV/quantity tính ML
  unit_price?: number   // đơn giá payout (LE=16, ML=95 ...)
  start_date: string
  end_date?: string     // NULL = đang hiệu lực
  note?: string
  created_by?: number
  created_at: Date
}

// ============================================================
// daily_downstream_rate
// ============================================================
export interface DailyDownstreamRate {
  id: number
  downstream_id: number
  date: string
  effective_rate: number
}

// ============================================================
// summary / payout
// ============================================================
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

export interface MLPayoutResult {
  total_revenue: number
  ml_payout: number
  payout_rate: number
}

export interface SummaryQuery {
  ad_type_code: AdTypeCode
  start_date: string
  end_date: string
}

// ============================================================
// user / auth
// ============================================================
export interface User {
  id: number
  username: string
  password_hash: string
  role: UserRole
  perm_data_input: boolean
  perm_data_confirm: boolean
  perm_admin: boolean
  status: UserStatus
  last_login_at?: Date
  created_at: Date
}

export interface UserPublic {
  id: number
  username: string
  role: UserRole
  perm_data_input: boolean
  perm_data_confirm: boolean
  perm_admin: boolean
  status: UserStatus
  last_login_at?: Date
  created_at: Date
}

export interface LoginPayload {
  username: string
  password: string
}

export interface AuthToken {
  token: string
  user: UserPublic
}

// ============================================================
// API response wrapper
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  page_size: number
}
