import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon : connexion directe (non poolée) conseillée pour les migrations ;
    // à défaut, DATABASE_URL est utilisée.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
