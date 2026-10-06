import { defineConfig } from "drizzle-kit";
import { urlMigraciones } from "./src/db/conexion";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Supabase trae sus propios esquemas (auth, storage…): solo se gestiona `public`.
  schemaFilter: ["public"],
  dbCredentials: { url: urlMigraciones()! },
});
