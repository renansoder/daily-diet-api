import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { knex } from '../database'
import { randomUUID } from 'node:crypto'
import { checkSessionIdExist } from '../middlewares/check-session-id'

export async function dailyDietRoutes(app: FastifyInstance) {
  // CRIAR USUÁRIO
  app.post('/user', async (req, reply) => {
    const createDietBodySchema = z.object({
      name: z.string()
    })

    const { name } = createDietBodySchema.parse(req.body)
    let sessionId = req.cookies.sessionId

    const user = await knex('users').where('name', name).select()
    if (user.length) {
      throw new Error('User already exists')
    }

    if (!sessionId || !user.length) {
      sessionId = randomUUID()
      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 // 1 dia
      })
    }
    await knex('users').insert({
      id: randomUUID(),
      name: name,
      session_id: sessionId
    })
  })

  // COMO SE FOSSE UM LOGIN- SETA O SESSION QUE ESTÁ SALVO NA TABELA USERS
  // COM ISSO MAIS DE UM USUÁRIO PODE CADASTRAR/EDITAR AS PRÓPRIAS REFEIÇÕES
  app.get('/user/:id', async (req, reply) => {
    const getParamsSchema = z.object({
      id: z.string().uuid()
    })
    const { id } = getParamsSchema.parse(req.params)
    const user = await knex('users').where('id', id).select()
    if (!user.length) {
      throw new Error('User not found')
    }

    reply.cookie('sessionId', user[0].session_id, {
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 // 1 dia
    })
  })

  // CRIAR A REFEIÇÃO
  app.post('/meal', async (req, reply) => {
    const createDietBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      date: z.string(),
      hour: z.string(),
      inside: z.boolean()
    })

    const { name, description, date, hour, inside } = createDietBodySchema.parse(req.body)
    const { sessionId } = req.cookies
    const user = await knex('users').where('session_id', sessionId).select()

    if (user.length) {
      await knex('meals').insert({
        id: randomUUID(),
        name,
        description,
        user_id: user[0].id,
        date,
        hour,
        inside
      })
    } else {
      throw new Error('User not found or not permission')
    }
  })

  // ATUALIZAR UMA REFEIÇÃO
  app.put('/meal/:id', { preHandler: [checkSessionIdExist] }, async (req, reply) => {
    const createDietBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      date: z.string(),
      hour: z.string(),
      inside: z.boolean()
    })

    const getParamsSchema = z.object({
      id: z.string().uuid()
    })
    const { id } = getParamsSchema.parse(req.params)
    const { name, description, date, hour, inside } = createDietBodySchema.parse(req.body)
    const { sessionId } = req.cookies

    const user = await knex('users').where('session_id', sessionId).select()
    if (!user.length) {
      throw new Error('User not found')
    }

    const meal = await knex('meals').where({ id: id, user_id: user[0].id }).select()
    if (meal.length) {
      await knex('meals').where({ id: id }).update({
        name,
        description,
        user_id: meal[0].user_id,
        date,
        hour,
        inside,
        updated_at: knex.fn.now()
      })
    } else {
      throw new Error('Meal not found or not permission')
    }
  })

  // EXCLUIR UMA REFEIÇÃO
  app.delete('/meal/:id', { preHandler: [checkSessionIdExist] }, async (req, reply) => {
    const getParamsSchema = z.object({
      id: z.string().uuid()
    })
    const { id } = getParamsSchema.parse(req.params)
    const { sessionId } = req.cookies
    const user = await knex('users').where('session_id', sessionId).select()
    if (!user.length) {
      throw new Error('User not found')
    }

    const meal = await knex('meals').where({ id: id, user_id: user[0].id }).select()

    if (meal.length) {
      await knex('meals').where({ id: id }).del()
    } else {
      throw new Error('Meal not found or not permission')
    }
  })

  // BUSCAR TODAS AS REFEIÇÕES DE UM USUÁRIO
  app.get('/meals/:id', { preHandler: [checkSessionIdExist] }, async (req, reply) => {
    const getParamsSchema = z.object({
      id: z.string().uuid()
    })
    const { id } = getParamsSchema.parse(req.params)
    const { sessionId } = req.cookies
    const user = await knex('users').where({ session_id: sessionId, id: id }).select()
    if (!user.length) {
      throw new Error('User not found or not permission')
    }
    const meals = await knex('meals').where({ user_id: id }).select()

    if (meals.length) {
      return { meals }
    } else {
      throw new Error('Meals not found')
    }
  })

  // BUSCAR UMA REFEIÇÃO ESPECÍFICA
  app.get('/meal/:id', { preHandler: [checkSessionIdExist] }, async (req, reply) => {
    const getParamsSchema = z.object({
      id: z.string().uuid()
    })
    const { id } = getParamsSchema.parse(req.params)
    const { sessionId } = req.cookies
    const user = await knex('users').where('session_id', sessionId).select()
    if (!user.length) {
      throw new Error('User not found')
    }
    const meal = await knex('meals').where({ id: id, user_id: user[0].id }).select()

    if (meal.length) {
      return { meal }
    } else {
      throw new Error('Meal not found')
    }
  })

  // BUSCAR MÉTRICAS
  app.get('/metrics/:id', { preHandler: [checkSessionIdExist] }, async (req, reply) => {
    const getParamsSchema = z.object({
      id: z.string().uuid()
    })
    const { id } = getParamsSchema.parse(req.params)
    const { sessionId } = req.cookies
    const userExist = await knex('users').where({ session_id: sessionId, id: id }).select()
    if (!userExist.length) {
      throw new Error('User not found')
    }

    const total = await knex('meals').where({ user_id: id }).count({ totalRefeicoes: 'id' })
    const isTrue = await knex('meals').where({ inside: true, user_id: id }).count({ dietTrue: 'id' })
    const isFalse = await knex('meals').where({ inside: false, user_id: id }).count({ dietFalse: 'id' })
    const sequence = await knex('meals').where({ inside: true, user_id: id }).select('name')
    return { total, isTrue, isFalse, sequence }
  })
}
