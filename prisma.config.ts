import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Cargar .env primero (valores por defecto)
config({ path: ".env" });
// Cargar .env.local después (sobreescribe .env)
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: env("DATABASE_URL"),
    // shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
