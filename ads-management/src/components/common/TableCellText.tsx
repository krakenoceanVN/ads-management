import type { CSSProperties, ReactNode } from 'react'

interface Props {
  value: string
  children?: ReactNode
  className?: string
  color?: CSSProperties['color']
  fontWeight?: CSSProperties['fontWeight']
}

export default function TableCellText({
  value,
  children,
  className,
  color,
  fontWeight = 'inherit',
}: Props) {
  const classes = ['app-table-cell-text', className].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      title={value}
      style={{
        color,
        fontWeight,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children ?? value}
    </span>
  )
}
