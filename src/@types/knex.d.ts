import { Knex } from 'knex'

declare module 'knex/types/tables' {
  export interface Tables {
    users: {
      id: string
      name: string
      session_id: string
    }
    meals: {
      id: string
      name: string
      description: string
      user_id: string
      date: string
      hour: string
      inside: boolean
      updated_at: Date
    }
  }
}
