import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import prisma from './prisma.js'
import dailyInputRouter from './routes/dailyInput.js'
import dashboardRouter from './routes/dashboard.js'
import adminRouter from './routes/admin.js'
import yiyiDataRouter from './routes/yiyiData.js'
import leDashboardRouter from './routes/leDashboard.js'

config()

const app = express()
const PORT = process.env.PORT ?? 3000

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json())

// Attach prisma to every request
app.use((req, _res, next) => {
  (req as any).prisma = prisma
  next()
})

// Routes
app.use('/api/daily-input', dailyInputRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/dashboard', leDashboardRouter)
app.use('/api', adminRouter)
app.use('/api', yiyiDataRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})
