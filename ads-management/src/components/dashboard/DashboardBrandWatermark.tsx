import brandLogoLightImage from '../../assets/trang-khong-logo.png'
import brandLogoDarkImage from '../../assets/den-khong-logo.png'
import { useThemeMode } from '../../theme/themeModeContext'
import type { CSSProperties } from 'react'

export default function DashboardBrandWatermark() {
  const { mode } = useThemeMode()
  const brandWatermarkImage = mode === 'light' ? brandLogoLightImage : brandLogoDarkImage
  const imageStyle = {
    '--dashboard-brand-watermark-image': `url("${brandWatermarkImage}")`,
  } as CSSProperties

  return (
    <div className="dashboard-brand-watermark" aria-hidden="true">
      <div className="dashboard-brand-watermark__art">
        <div
          className="dashboard-brand-watermark__image"
          style={imageStyle}
        />
      </div>
    </div>
  )
}
