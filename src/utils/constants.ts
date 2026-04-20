import type { AdTypeCode } from "../types/index.js"

export const AD_TYPE_ID_MAP: Record<AdTypeCode, number> = {
  SM: 1,
  "360": 2,
  BAIDU_JS: 3,
  OTHER: 4,
}

export const DEFAULT_DOWNSTREAM_PRICES: Record<string, number> = {
  "18": 95,
  "19": 16,
  "21": 80,
  "22": 75,
  "23": 70,
}
