import { useTranslation } from 'react-i18next'
import { Button } from 'antd'

interface Props {
  dirtyCount: number
  loading: boolean
  canSave?: boolean
  disabledReason?: string
  onSave: () => void
}

export default function SaveBar({
  dirtyCount,
  loading,
  canSave = true,
  disabledReason,
  onSave,
}: Props) {
  const { t } = useTranslation()
  const isDisabled = !canSave || dirtyCount === 0

  return (
    <div className="save-bar" style={{ position: 'sticky', bottom: 0, zIndex: 99 }}>
      {dirtyCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {t('input.changeCount', { count: dirtyCount })}
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              animation: 'pulse 2s infinite',
            }}
          />
        </div>
      )}

      <Button
        className="save-bar-btn"
        type="primary"
        size="large"
        disabled={isDisabled}
        loading={loading}
        onClick={onSave}
        title={!canSave ? disabledReason : undefined}
        style={{
          height: 40,
          paddingLeft: 24,
          paddingRight: 24,
          borderRadius: 'var(--radius-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          fontSize: 'var(--font-size-md)',
          boxShadow: dirtyCount > 0 && canSave ? 'var(--shadow-md)' : 'none',
        }}
      >
        {t('input.saveN', { n: dirtyCount })}
      </Button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
