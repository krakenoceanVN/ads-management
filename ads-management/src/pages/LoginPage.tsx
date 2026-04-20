import { Form, Input, Button, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import brandLogoLightImage from '../assets/krakenocen-global.png'
import brandLogoDarkImage from '../assets/lK72y.jpg'
import { useThemeMode } from '../theme/themeModeContext'
import type { User } from '../types'

interface LoginValues {
  username: string
  password: string
}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { mode } = useThemeMode()
  const brandLogoImage = mode === 'light' ? brandLogoLightImage : brandLogoDarkImage
  const [form] = Form.useForm()

  const handleSubmit = async (values: LoginValues) => {
    try {
      const res = await api.post<{ success: boolean; token: string; user: User }>(
        '/api/auth/login',
        values
      )
      if (res.data.success && res.data.token) {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        message.success(t('login.success'))
        navigate('/')
      }
    } catch {
      message.error(t('login.fail'))
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen-orbs" />

      <div className="login-shell">
        <div className="login-branding">
          <div className="login-brand-icon">
            <img src={brandLogoImage} alt={t('app.brand')} className="login-brand-image" />
          </div>
          <h2>{t('login.title')}</h2>
          <p>Sign in to your account</p>
        </div>

        <div className="login-card">
          <Form
            className="login-form"
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              label={
                <span className="login-field-label">{t('login.username')}</span>
              }
              name="username"
              rules={[{ required: true, message: t('login.enterUsername') }]}
            >
              <Input
                className="login-input"
                size="large"
                placeholder="Enter your username"
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="login-field-label">{t('login.password')}</span>
              }
              name="password"
              rules={[{ required: true, message: t('login.enterPassword') }]}
            >
              <Input.Password
                className="login-input"
                size="large"
                placeholder="Enter your password"
              />
            </Form.Item>

            <Form.Item className="login-submit-row">
              <Button
                className="login-submit-btn"
                type="primary"
                htmlType="submit"
                block
                size="large"
              >
                {t('login.submit')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}
