import { useLayoutEffect, useRef, useState } from 'react'

interface Props {
  value: string
  className?: string
  minFontSize?: number
  maxFontSize?: number
}

const OVERFLOW_TOLERANCE_PX = 1

export default function KpiValueText({
  value,
  className,
  minFontSize = 18,
  maxFontSize = 31,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [fontSize, setFontSize] = useState<number | null>(null)
  const [wrap, setWrap] = useState(false)

  useLayoutEffect(() => {
    const host = hostRef.current
    const text = textRef.current

    if (!host || !text) return

    let frame = 0

    const measure = () => {
      const availableWidth = host.clientWidth
      if (availableWidth <= 0) return

      const computedMaxFontSize = parseFloat(getComputedStyle(host).fontSize) || maxFontSize

      text.style.fontSize = `${computedMaxFontSize}px`
      text.style.whiteSpace = 'nowrap'
      text.style.wordBreak = 'normal'

      const naturalWidth = text.scrollWidth
      let nextFontSize = computedMaxFontSize
      let shouldWrap = false

      if (naturalWidth > availableWidth + OVERFLOW_TOLERANCE_PX) {
        nextFontSize = Math.max(minFontSize, (computedMaxFontSize * availableWidth) / naturalWidth)
        text.style.fontSize = `${nextFontSize}px`

        if (
          nextFontSize <= minFontSize + 0.5 &&
          text.scrollWidth > availableWidth + OVERFLOW_TOLERANCE_PX
        ) {
          shouldWrap = true
        }
      }

      const roundedFontSize = Number(nextFontSize.toFixed(2))

      setFontSize((current) => {
        if (current == null) return roundedFontSize
        return Math.abs(current - roundedFontSize) < 0.25 ? current : roundedFontSize
      })
      setWrap((current) => (current === shouldWrap ? current : shouldWrap))
    }

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(host)
    scheduleMeasure()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [maxFontSize, minFontSize, value])

  const classes = ['kpi-value', className].filter(Boolean).join(' ')
  const textClasses = ['kpi-value-text', wrap ? 'is-wrapped' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={hostRef} className={classes} title={value}>
      <span
        ref={textRef}
        className={textClasses}
        style={fontSize == null ? undefined : { fontSize }}
      >
        {value}
      </span>
    </div>
  )
}
