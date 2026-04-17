import { Button, Modal } from 'antd'
import { UnlockOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

interface Props {
  loading?: boolean
  onConfirm: () => Promise<unknown> | unknown
}

export default function UnlockRecordButton({ loading = false, onConfirm }: Props) {
  const { t } = useTranslation()

  return (
    <Button
      size="small"
      type="link"
      icon={<UnlockOutlined />}
      loading={loading}
      style={{ color: '#d48806' }}
      onClick={() => {
        Modal.confirm({
          title: t('input.unlock'),
          content: t('input.unlockConfirm'),
          okText: t('input.confirm'),
          cancelText: t('input.cancel'),
          onOk: () => onConfirm(),
        })
      }}
    >
      {t('input.unlock')}
    </Button>
  )
}
