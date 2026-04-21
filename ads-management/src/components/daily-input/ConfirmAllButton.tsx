import { Button, Modal } from 'antd'
import { useTranslation } from 'react-i18next'

interface Props {
  disabled: boolean
  loading?: boolean
  onConfirm: () => Promise<unknown> | unknown
}

export default function ConfirmAllButton({ disabled, loading = false, onConfirm }: Props) {
  const { t } = useTranslation()

  return (
    <Button
      className="daily-input-confirm-all-btn"
      type="primary"
      disabled={disabled}
      loading={loading}
      onClick={() => {
        Modal.confirm({
          title: t('input.confirmAll'),
          content: t('input.confirmAllWarning'),
          okText: t('input.confirmAllOk'),
          cancelText: t('input.confirmAllCancel'),
          onOk: () => onConfirm(),
        })
      }}
    >
      {t('input.confirmAll')}
    </Button>
  )
}
