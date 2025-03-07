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
        let query = pgDb.select({
          id: schema.reportTemplates.id,
          name: schema.reportTemplates.name,
          format: schema.reportTemplates.format,
          client_id: schema.reportTemplates.clientId,
          client_name: schema.clients.name,
          example_prompt: schema.reportTemplates.examplePrompt,
          created_at: schema.reportTemplates.createdAt,
          updated_at: schema.reportTemplates.updatedAt
        })
        .from(schema.reportTemplates)
        .leftJoin(schema.clients, eq(schema.reportTemplates.clientId, schema.clients.id));
        
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
          // Check if this is a templates query
          if (query.includes('FROM report_templates t') && query.includes('LEFT JOIN clients c')) {
            try {
              // For template queries, ensure we return with the expected field names
              const result = await sql.query(query, params);
              return result.rows.map((row: any) => ({
                id: row.id,
                name: row.name,
                format: row.format,
                client_id: row.client_id,
                client_name: row.client_name,
                example_prompt: row.example_prompt,
                created_at: row.created_at,
                updated_at: row.updated_at
              }));
            } catch (error) {
              console.error('Error in Postgres template query:', error);
              return [];
            }
          }
          
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