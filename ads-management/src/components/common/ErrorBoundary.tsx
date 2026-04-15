import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import i18n from '../../i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Result
            status="error"
            title={i18n.t('errorBoundary.title')}
            subTitle={this.state.error?.message || i18n.t('errorBoundary.unknown')}
            extra={
              <Button
                type="primary"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  window.location.reload()
                }}
              >
                {i18n.t('errorBoundary.reload')}
              </Button>
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}
