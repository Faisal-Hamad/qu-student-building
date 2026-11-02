import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { ZodError } from 'zod'
import { csrfMiddleware, sessionMiddleware, type AppEnv } from './auth.js'
import { authRoutes, setupRoutes } from './routes/auth.js'
import { housingRoutes } from './routes/housing.js'
import { roleRoutes, staffRoutes, studentRoutes } from './routes/people.js'
import { maintenanceRoutes } from './routes/maintenance.js'
import { inspectionRoutes, myInspectionRoute, publicRoutes, settingsRoutes } from './routes/inspections.js'
import { activityRoutes, backupRoutes, cronRoutes, notificationRoutes } from './routes/system.js'

export const app = new Hono<AppEnv>().basePath('/api')

app.use('*', secureHeaders())
app.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})
app.use('*', csrfMiddleware)
app.use('*', sessionMiddleware)

app
  .route('/auth', authRoutes)
  .route('/setup', setupRoutes)
  .route('/housing', housingRoutes)
  .route('/students', studentRoutes)
  .route('/staff', staffRoutes)
  .route('/roles', roleRoutes)
  .route('/maintenance', maintenanceRoutes)
  .route('/inspections', inspectionRoutes)
  .route('/settings', settingsRoutes)
  .route('/public', publicRoutes)
  .route('/me/inspection', myInspectionRoute)
  .route('/notifications', notificationRoutes)
  .route('/activity', activityRoutes)
  .route('/backup', backupRoutes)
  .route('/cron', cronRoutes)

app.notFound((c) => c.json({ error: 'غير موجود' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  if (err instanceof ZodError) return c.json({ error: err.issues[0]?.message ?? 'بيانات غير صحيحة' }, 400)
  if (err instanceof SyntaxError) return c.json({ error: 'بيانات غير صحيحة' }, 400)
  console.error(err)
  return c.json({ error: 'حدث خطأ غير متوقع' }, 500)
})
