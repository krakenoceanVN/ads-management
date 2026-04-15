export const ISO_GROUP_SEPARATOR = '\u00A0'

export function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\u00A0/g, '').replace(/\s/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatIsoNumber(value: unknown, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('en-US', {
    useGrouping: true,
    ...options,
  })
    .format(toFiniteNumber(value))
    .replace(/,/g, ISO_GROUP_SEPARATOR)
}

export function formatIsoInteger(value: unknown): string {
  return formatIsoNumber(value, { maximumFractionDigits: 0 })
}

export function formatIsoFixed(value: unknown, fractionDigits: number): string {
  return formatIsoNumber(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatIsoMoney(value: unknown): string {
  return formatIsoFixed(value, 2)
}

export function formatIsoPercent(
  value: unknown,
  options: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    scale?: number
  } = {}
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    scale = 100,
  } = options

  return `${formatIsoNumber(toFiniteNumber(value) * scale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })}%`
}
