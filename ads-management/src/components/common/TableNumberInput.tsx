import { forwardRef, type CSSProperties } from 'react'
import { InputNumber } from 'antd'
import type { InputNumberProps } from 'antd'
import type { InputNumberRef } from '@rc-component/input-number'

type TableNumberInputProps = InputNumberProps<number>

function resolveTitle(value: unknown, title?: string) {
  if (title) return title
  if (value == null || value === '') return undefined
  return String(value)
}

const TableNumberInput = forwardRef<InputNumberRef, TableNumberInputProps>(function TableNumberInput(
  { className, style, title, value, ...props },
  ref,
) {
  const mergedClassName = ['app-table-number-input', className].filter(Boolean).join(' ')
  const mergedStyle: CSSProperties = {
    ...style,
    width: style?.width ?? '100%',
    minWidth: style?.minWidth ?? 0,
    maxWidth: style?.maxWidth ?? '100%',
  }

  return (
    <InputNumber
      ref={ref}
      {...props}
      value={value}
      title={resolveTitle(value, title)}
      className={mergedClassName}
      style={mergedStyle}
    />
  )
})

export default TableNumberInput
