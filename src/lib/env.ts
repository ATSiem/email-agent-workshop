import { z } from "zod";

// Different schema for server and client side
const serverEnvSchema = z.object({
  // SQLite
  SQLITE_DB_PATH: z.string().default("./data/email_agent.db"),
  
  // OpenAI
  OPENAI_API_KEY: z.string().optional().default(""),
  
  // OpenAI model selection
  OPENAI_SUMMARY_MODEL: z.string().optional().default("gpt-3.5-turbo"),
  OPENAI_REPORT_MODEL: z.string().optional().default("gpt-4o-2024-08-06"),
  OPENAI_EMBEDDING_MODEL: z.string().optional().default("text-embedding-3-small"),
  
  // Email processing limits
  EMAIL_FETCH_LIMIT: z.coerce.number().optional().default(1000),
  EMAIL_PROCESSING_BATCH_SIZE: z.coerce.number().optional().default(200),
  EMAIL_EMBEDDING_BATCH_SIZE: z.coerce.number().optional().default(200),
  EMBEDDING_BATCH_SIZE: z.coerce.number().optional().default(20),
  
  // Dynamic calculation flags
  USE_DYNAMIC_MODEL_LIMITS: z.string().optional()
    .transform(val => val === 'true')
    .default('true'),
  
  // Microsoft Graph API - server-side env vars
  AZURE_CLIENT_ID: z.string().optional().default(""),
  AZURE_TENANT_ID: z.string().optional().default(""),
  
  // Public env vars
  NEXT_PUBLIC_AZURE_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_AZURE_TENANT_ID: z.string().optional(),
  NEXT_PUBLIC_AZURE_REDIRECT_URI: z.string().optional(),
  
  // Webhook (still needed for backwards compatibility)
  WEBHOOK_SECRET: z.string().default("dummy-webhook-secret"),
});

// Empty client schema - we'll use NEXT_PUBLIC_ vars directly
const clientEnvSchema = z.object({});

// Create validated env object safely
function createEnv() {
  // For server-side usage, validate all required vars
  if (typeof window === 'undefined') {
    try {
      return serverEnvSchema.parse(process.env);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const { fieldErrors } = err.flatten();
        const errorMessage = Object.entries(fieldErrors)
          .map(([field, errors]) =>
            errors ? `${field}: ${errors.join(", ")}` : field,
          )
          .join("\n  ");
        console.error(`Missing server environment variables:\n  ${errorMessage}`);
        // Return a fallback with default values
        return serverEnvSchema.partial().parse(process.env);
      }
      console.error('Unknown environment validation error:', err);
      return {} as any;
    }
  } 
  // For client-side, just use the minimal set needed
  else {
    try {
      return clientEnvSchema.parse(process.env);
    } catch (err) {
      console.error('Client environment validation error:', err);
      return {} as any;
    }
  }
}

export const env = createEnv();
