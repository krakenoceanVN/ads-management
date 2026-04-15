import { useTranslation } from 'react-i18next'
import { LockOutlined } from '@ant-design/icons'

interface Props {
  status: 'unconfirmed' | 'confirmed'
}

export default function StatusBadge({ status }: Props) {
  const { t } = useTranslation()
  const confirmed = status === 'confirmed'

  return (
    <span className={`status-badge ${confirmed ? 'is-confirmed' : 'is-unconfirmed'}`}>
      <span className="status-badge-dot" />
      <span className="status-badge-label">
        {confirmed ? t('input.confirmed') : t('input.unconfirmed')}
      </span>
      {confirmed && <LockOutlined className="status-badge-lock" />}
    </span>
  )
}
