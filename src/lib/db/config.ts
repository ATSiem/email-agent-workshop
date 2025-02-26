import { defineConfig } from "drizzle-kit";
import { env } from "~/lib/env";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: { 
    url: `file:${env.SQLITE_DB_PATH}`,
  },
});
