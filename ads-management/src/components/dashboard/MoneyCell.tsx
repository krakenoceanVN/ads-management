import { formatIsoMoney } from '../../utils/numberFormat'

interface Props {
  value: number
  colorize?: boolean
}

export default function MoneyCell({ value, colorize }: Props) {
  const formatted = formatIsoMoney(value)

  if (!colorize) {
    return (
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 'var(--font-weight-medium)',
        }}
      >
        {formatted}
      </span>
    )
  }

  const color =
    value < 0
      ? 'var(--color-danger)'
      : value > 0
        ? 'var(--color-success)'
        : 'var(--color-text-secondary)'

  return (
    <span
      style={{
        color,
        fontWeight: 'var(--font-weight-semibold)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatted}
    </span>
  )
}
