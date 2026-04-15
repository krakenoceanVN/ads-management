import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'
import type { ColumnsType } from 'antd/es/table'
import TableCellText from '../components/common/TableCellText'

interface TableTextOptions {
  className?: string
  color?: string
  fontWeight?: string | number
}

function wrapHeaderTitle(title: unknown): unknown {
  if (typeof title === 'string' || typeof title === 'number') {
    return (
      <span className="app-table-header-text" title={String(title)}>
        {title}
      </span>
    )
  }

  return title
}

function wrapRenderedNode(node: unknown): unknown {
  if (node == null || typeof node === 'boolean') return node

  if (typeof node === 'string' || typeof node === 'number') {
    return renderTableText(String(node))
  }

  if (isValidElement<{ children?: ReactNode; className?: string; title?: string }>(node) && typeof node.type === 'string') {
    const children = node.props.children

    if (typeof children === 'string' || typeof children === 'number') {
      const value = String(children)
      const className = ['app-table-cell-text', node.props.className].filter(Boolean).join(' ')

      return cloneElement(node, {
        className,
        title: node.props.title ?? value,
      })
    }
  }

  return node
}

export function renderTableText(value: string, options: TableTextOptions = {}) {
  return (
    <TableCellText
      value={value}
      className={options.className}
      color={options.color}
      fontWeight={options.fontWeight}
    >
      {value}
    </TableCellText>
  )
}

export function withTableEllipsis<T>(columns: ColumnsType<T>): ColumnsType<T> {
  return columns.map((column) => {
    const nextColumn: Record<string, unknown> = {
      ...column,
      title: wrapHeaderTitle(column.title),
    }

    if ('children' in column && column.children) {
      nextColumn.children = withTableEllipsis(column.children)
      return nextColumn as ColumnsType<T>[number]
    }

    nextColumn.ellipsis = column.ellipsis ?? { showTitle: true }

    if (column.render) {
      const originalRender = column.render as (...args: unknown[]) => unknown
      nextColumn.render = (...args: unknown[]) => wrapRenderedNode(originalRender(...args))
    }

    return nextColumn as ColumnsType<T>[number]
  })
}
