import fastify from 'fastify'
import cookie from '@fastify/cookie'
import { dailyDietRoutes } from './routes/dailyDiet'

export const app = fastify()
app.register(cookie)

app.register(dailyDietRoutes, {
  prefix: 'diet'
})
