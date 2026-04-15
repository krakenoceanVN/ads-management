import TableCellText from '../common/TableCellText'
import { formatIsoMoney } from '../../utils/numberFormat'

interface Props {
  value: number
  colorize?: boolean
}

export default function MoneyCell({ value, colorize }: Props) {
  const formatted = formatIsoMoney(value)

  if (!colorize) {
    return (
      <TableCellText value={formatted} fontWeight="var(--font-weight-medium)">
        {formatted}
      </TableCellText>
    )
  }

  const color =
    value < 0
      ? 'var(--color-danger)'
      : value > 0
        ? 'var(--color-success)'
        : 'var(--color-text-secondary)'

  return (
    <TableCellText
      value={formatted}
      color={color}
      fontWeight="var(--font-weight-semibold)"
    >
      {formatted}
    </TableCellText>
  )
}
