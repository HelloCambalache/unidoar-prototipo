# UNIDOAR

Plataforma que conecta instituciones (colegios, clubes, natatorios) con docentes, profesores, entrenadores y guardavidas verificados.

Next.js 16 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) + Drizzle · Vercel.

> El prototipo navegable original está en [`prototipo/`](prototipo/) como referencia visual. La guía de arquitectura y convenciones es [`CLAUDE.md`](CLAUDE.md); las pantallas y tokens de marca, [`HANDOFF.md`](HANDOFF.md).

## Puesta en marcha

```bash
pnpm install
vercel link                          # proyecto: cambalaches-projects/unidoar-prototipo
vercel env pull .env.local --yes     # variables de Supabase
pnpm db:setup                        # tablas + RLS + buckets + datos de ejemplo
pnpm dev
```

Variables necesarias: ver [`.env.example`](.env.example). Supabase se instala desde el Marketplace de Vercel (aprovisiona las variables solo).

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` / `lint` | Verificaciones |
| `pnpm db:push` | Aplica `src/db/schema.ts` a la base (desarrollo) |
| `pnpm db:rls` | Activa RLS en todas las tablas (obligatorio tras cada `db:push`) |
| `pnpm db:storage` | Crea los buckets `publico` y `privado` |
| `pnpm db:setup` | push + rls + storage + seed |
| `pnpm db:generate` / `db:migrate` | Migraciones versionadas (producción) |
| `pnpm db:seed` | Catálogos reales + datos demo (`--solo-catalogos`, `--borrar-demo`) |
| `pnpm db:vincular` | Liga cuentas reales de Supabase con datos demo (`--institucion=<correo> --docente=<correo>`); repetir tras cada `db:seed` |
| `pnpm db:studio` | Explorador de la base |

## Ramas

- `main`: el prototipo estático que está desplegado hoy (archivos en la raíz, con su propio `vercel.json`).
- `feat/app-dinamica`: la app real. No se hace merge a `main` hasta decidirlo, porque cambia lo que se publica en producción.
