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

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function extractTextValue(node: ReactNode): string | null {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    const parts = node
      .map((value) => extractTextValue(value))
      .filter((value): value is string => Boolean(value))

    return parts.length > 0 ? parts.join('') : null
  }

  return null
}

function wrapRenderedNode(node: unknown): unknown {
  if (node == null || typeof node === 'boolean') return node

  if (typeof node === 'string' || typeof node === 'number') {
    return renderTableText(String(node))
  }

  if (isValidElement<{ children?: ReactNode; className?: string; title?: string; href?: string; to?: unknown }>(node)) {
    const value = extractTextValue(node.props.children)

    if (value && typeof node.type === 'string') {
      return cloneElement(node, {
        className: mergeClassNames(
          'app-table-cell-text',
          node.type === 'a' ? 'app-table-link' : undefined,
          node.props.className,
        ),
        title: node.props.title ?? value,
      })
    }

    if (value && (node.props.href != null || node.props.to != null)) {
      return cloneElement(node, {
        className: mergeClassNames('app-table-cell-text', 'app-table-link', node.props.className),
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
