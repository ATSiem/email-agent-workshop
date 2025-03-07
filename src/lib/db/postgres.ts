import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './pg-schema';

// Create a Drizzle client with Vercel Postgres
export const pgDb = drizzle(sql, { schema });

// Export compatibility layer with same interface as current SQLite code
export const compatDb = {
  query: {
    clients: {
      findFirst: async ({ where }: any) => {
        if (where && where[0] && where[0].name === 'eq' && where[0].column === 'id') {
          const clientId = where[0].value;
          const result = await pgDb.select().from(schema.clients).where(eq(schema.clients.id, clientId)).limit(1);
          return result.length > 0 ? result[0] : null;
        }
        return null;
      },
      findMany: async (params?: any) => {
        return await pgDb.select().from(schema.clients).orderBy(schema.clients.name);
      }
    },
    reportTemplates: {
      findFirst: async ({ where }: any) => {
        if (where && where[0] && where[0].name === 'eq' && where[0].column === 'id') {
          const templateId = where[0].value;
          const result = await pgDb.select().from(schema.reportTemplates).where(eq(schema.reportTemplates.id, templateId)).limit(1);
          return result.length > 0 ? result[0] : null;
        }
        return null;
      },
      findMany: async (params?: any) => {
        let query = pgDb.select().from(schema.reportTemplates);
        
        // Handle clientId filter if present
        if (params && params.where && params.where.clientId) {
          query = query.where(eq(schema.reportTemplates.clientId, params.where.clientId));
        }
        
        return await query;
      }
    },
    // Add other tables as needed
  },
  connection: {
    // Implement a compatibility layer for raw SQL
    prepare: (query: string) => {
      console.log('Postgres compatibility layer - Raw SQL:', query);
      
      return {
        run: async (...params: any[]) => {
          await sql.query(query, params);
        },
        get: async (...params: any[]) => {
          const result = await sql.query(query, params);
          return result.rows[0];
        },
        all: async (...params: any[]) => {
          const result = await sql.query(query, params);
          return result.rows;
        }
      };
    }
  },
  // Add insert, update, delete methods
  insert: async (table: string, data: any) => {
    if (table === 'clients') {
      return await pgDb.insert(schema.clients).values(data);
    } else if (table === 'report_templates') {
      return await pgDb.insert(schema.reportTemplates).values(data);
    } else if (table === 'messages') {
      return await pgDb.insert(schema.messages).values(data);
    } else if (table === 'report_feedback') {
      return await pgDb.insert(schema.reportFeedback).values(data);
    }
  },
  update: async (table: string, id: string, data: any) => {
    if (table === 'clients') {
      return await pgDb.update(schema.clients).set(data).where(eq(schema.clients.id, id));
    } else if (table === 'report_templates') {
      return await pgDb.update(schema.reportTemplates).set(data).where(eq(schema.reportTemplates.id, id));
    } else if (table === 'messages') {
      return await pgDb.update(schema.messages).set(data).where(eq(schema.messages.id, id));
    } else if (table === 'report_feedback') {
      return await pgDb.update(schema.reportFeedback).set(data).where(eq(schema.reportFeedback.id, id));
    }
  }
}; 