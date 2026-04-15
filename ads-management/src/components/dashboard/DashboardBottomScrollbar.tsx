import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'

interface Props {
  tableHostRef: RefObject<HTMLElement | null>
  watchKey: string
  className?: string
}

interface Metrics {
  clientWidth: number
  scrollWidth: number
  scrollLeft: number
}

const OVERFLOW_TOLERANCE_PX = 4
const DASHBOARD_SCROLLBAR_HEIGHT = '17px'

function getMainScrollNode(host: HTMLElement): HTMLElement | null {
  const nodes = Array.from(
    host.querySelectorAll<HTMLElement>('.ant-table-content, .ant-table-body')
  )

  return (
    nodes.find(
      (node) =>
        !node.closest('.ant-table-summary') &&
        !node.closest('.ant-table-header') &&
        node.scrollWidth > node.clientWidth
    ) ??
    nodes.find(
      (node) =>
        !node.closest('.ant-table-summary') && !node.closest('.ant-table-header')
    ) ??
    null
  )
}

export default function DashboardBottomScrollbar({
  tableHostRef,
  watchKey,
  className,
}: Props) {
  const scrollNodeRef = useRef<HTMLElement | null>(null)
  const dragStateRef = useRef({ startX: 0, startScrollLeft: 0 })
  const [metrics, setMetrics] = useState<Metrics>({
    clientWidth: 0,
    scrollWidth: 0,
    scrollLeft: 0,
  })

  const { thumbWidth, thumbOffset, maxScrollLeft, maxThumbOffset } = useMemo(() => {
    const nextMaxScrollLeft = Math.max(metrics.scrollWidth - metrics.clientWidth, 0)
    const nextThumbWidth = nextMaxScrollLeft > 0
      ? Math.max((metrics.clientWidth * metrics.clientWidth) / metrics.scrollWidth, 48)
      : Math.max(metrics.clientWidth - 16, 32)
    const nextMaxThumbOffset = Math.max(metrics.clientWidth - nextThumbWidth, 0)
    const nextThumbOffset = nextMaxScrollLeft > 0 && nextMaxThumbOffset > 0
      ? (metrics.scrollLeft / nextMaxScrollLeft) * nextMaxThumbOffset
      : 0

    return {
      thumbWidth: nextThumbWidth,
      thumbOffset: nextThumbOffset,
      maxScrollLeft: nextMaxScrollLeft,
      maxThumbOffset: nextMaxThumbOffset,
    }
  }, [metrics.clientWidth, metrics.scrollLeft, metrics.scrollWidth])

  const isVisible = metrics.clientWidth > 0 && metrics.scrollWidth - metrics.clientWidth > OVERFLOW_TOLERANCE_PX

  useEffect(() => {
    const host = tableHostRef.current
    if (!host) return

    host.style.setProperty(
      '--dashboard-sticky-scroll-h',
      isVisible ? DASHBOARD_SCROLLBAR_HEIGHT : '0px',
    )

    return () => {
      host.style.removeProperty('--dashboard-sticky-scroll-h')
    }
  }, [isVisible, tableHostRef])

  useEffect(() => {
    const host = tableHostRef.current
    if (!host) return

    const scrollNode = getMainScrollNode(host)
    scrollNodeRef.current = scrollNode

    if (!scrollNode) {
      host.style.setProperty('--dashboard-sticky-scroll-h', '0px')
      setMetrics({ clientWidth: 0, scrollWidth: 0, scrollLeft: 0 })
      return
    }

    const syncMetrics = () => {
      const tableElement = scrollNode.querySelector('table') as HTMLElement | null
      const tableWidth = tableElement
        ? Math.max(tableElement.scrollWidth, tableElement.offsetWidth, Math.round(tableElement.getBoundingClientRect().width))
        : 0
      const scrollWidth = Math.max(scrollNode.scrollWidth, tableWidth)

      setMetrics({
        clientWidth: scrollNode.clientWidth,
        scrollWidth,
        scrollLeft: scrollNode.scrollLeft,
      })
    }

    const handleTableScroll = () => {
      syncMetrics()
    }

    syncMetrics()

    scrollNode.addEventListener('scroll', handleTableScroll, { passive: true })

    const resizeObserver = new ResizeObserver(syncMetrics)
    resizeObserver.observe(scrollNode)
    resizeObserver.observe(host)

    const tableElement = scrollNode.querySelector('table')
    if (tableElement instanceof HTMLElement) {
      resizeObserver.observe(tableElement)
    }

    window.addEventListener('resize', syncMetrics, { passive: true })
    window.addEventListener('scroll', syncMetrics, true)

    return () => {
      scrollNode.removeEventListener('scroll', handleTableScroll)
      window.removeEventListener('resize', syncMetrics)
      resizeObserver.disconnect()
    }
  }, [tableHostRef, watchKey])

  const handleThumbMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const scrollNode = scrollNodeRef.current
    if (!scrollNode || maxScrollLeft <= 0 || maxThumbOffset <= 0) return

    dragStateRef.current = {
      startX: event.clientX,
      startScrollLeft: scrollNode.scrollLeft,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragStateRef.current.startX
      const nextScrollLeft = dragStateRef.current.startScrollLeft + (deltaX / maxThumbOffset) * maxScrollLeft
      scrollNode.scrollLeft = Math.min(Math.max(nextScrollLeft, 0), maxScrollLeft)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }

    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    event.preventDefault()
    event.stopPropagation()
  }

  const handleTrackMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const scrollNode = scrollNodeRef.current
    if (!scrollNode || maxScrollLeft <= 0 || maxThumbOffset <= 0) return

    const trackRect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - trackRect.left
    const nextThumbOffset = Math.min(Math.max(clickX - thumbWidth / 2, 0), maxThumbOffset)
    scrollNode.scrollLeft = (nextThumbOffset / maxThumbOffset) * maxScrollLeft
  }

  return (
    <div
      className={`dashboard-bottom-scrollbar${!isVisible ? ' is-hidden' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden={!isVisible}
    >
      <div className="dashboard-bottom-scrollbar-track" onMouseDown={handleTrackMouseDown}>
        <div
          className="dashboard-bottom-scrollbar-thumb"
          onMouseDown={handleThumbMouseDown}
          style={{
            width: `${thumbWidth}px`,
            transform: `translateX(${thumbOffset}px)`,
          }}
        />
      </div>
    </div>
  )
}
