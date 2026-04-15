import { useTranslation } from 'react-i18next'
import { Button } from 'antd'

interface Props {
  dirtyCount: number
  loading: boolean
  onSave: () => void
}

export default function SaveBar({ dirtyCount, loading, onSave }: Props) {
  const { t } = useTranslation()

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
            {dirtyCount} {dirtyCount === 1 ? 'change' : 'changes'}
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
        disabled={dirtyCount === 0}
        loading={loading}
        onClick={onSave}
        style={{
          height: 40,
          paddingLeft: 24,
          paddingRight: 24,
          borderRadius: 'var(--radius-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          fontSize: 'var(--font-size-md)',
          boxShadow: dirtyCount > 0 ? 'var(--shadow-md)' : 'none',
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
