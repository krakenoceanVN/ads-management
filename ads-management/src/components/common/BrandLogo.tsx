import { useTranslation } from 'react-i18next'
import brandMark from '../../assets/krakenocean-mark.svg'

interface BrandLogoProps {
  compact?: boolean
  showText?: boolean
  variant?: 'sidebar' | 'login'
  className?: string
}

export default function BrandLogo({
  compact = false,
  showText,
  variant = 'sidebar',
  className = '',
}: BrandLogoProps) {
  const { t } = useTranslation()
  const brand = t('app.brand')
  const [primary, ...rest] = brand.split(' ')
  const secondary = rest.join(' ')
  const renderText = showText ?? !compact
  const classes = ['brand-logo', `brand-logo--${variant}`, compact ? 'is-compact' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <span className="brand-logo-mark" aria-hidden>
        <img src={brandMark} alt="" className="brand-logo-image" />
      </span>
      {renderText && (
        <span className="brand-logo-text">
          <span className="brand-logo-line brand-logo-line--primary">{primary}</span>
          {secondary ? <span className="brand-logo-line brand-logo-line--secondary">{secondary}</span> : null}
        </span>
      )}
    </div>
  )
}
