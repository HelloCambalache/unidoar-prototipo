/*
 * Avisos por WhatsApp: crea `consentimientos_whatsapp` (quién aceptó recibirlos y en qué número) y `cola_whatsapp` (la cola de avisos, igual que `cola_correos`),
 * las dos con RLS. Ver src/lib/whatsapp y docs/whatsapp.md.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que las usa (el código viejo las ignora). Una tabla nueva sin RLS queda
 * expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después (y confirmar que estas dos siguen con RLS).
 * No toca ninguna fila existente ni manda nada.
 * Uso: pnpm db:whatsapp
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:whatsapp).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.consentimientos_whatsapp (
        usuario_id uuid primary key references public.usuarios(id) on delete cascade,
        telefono text not null,
        clave text not null,
        otorgado_en timestamptz not null default now(),
        baja_en timestamptz,
        origen text not null default 'cuenta',
        version text not null
      )`;
    await tx`create index if not exists consentimientos_whatsapp_clave_idx on public.consentimientos_whatsapp (clave)`;
    await tx`alter table public.consentimientos_whatsapp enable row level security`;

    await tx`
      create table if not exists public.cola_whatsapp (
        id uuid primary key default gen_random_uuid(),
        creado_en timestamptz not null default now(),
        para text not null,
        usuario_id uuid references public.usuarios(id) on delete set null,
        tipo text not null default 'plantilla',
        plantilla text not null,
        datos jsonb not null default '{}'::jsonb,
        clave text,
        estado text not null default 'pendiente',
        intentos integer not null default 0,
        reclamado_en timestamptz,
        enviado_en timestamptz,
        motivo text,
        wamid text
      )`;
    await tx`create index if not exists cola_whatsapp_estado_idx on public.cola_whatsapp (estado, creado_en)`;
    await tx`create unique index if not exists cola_whatsapp_clave_uq on public.cola_whatsapp (clave, para)`;
    await tx`create index if not exists cola_whatsapp_wamid_idx on public.cola_whatsapp (wamid)`;
    await tx`create index if not exists cola_whatsapp_para_idx on public.cola_whatsapp (para, enviado_en)`;
    await tx`alter table public.cola_whatsapp enable row level security`;
  });

  const [{ consentimientos }] = await sql`select count(*)::int as consentimientos from public.consentimientos_whatsapp`;
  const [{ avisos }] = await sql`select count(*)::int as avisos from public.cola_whatsapp`;
  const rls = await sql`
    select relname, relrowsecurity as rls from pg_class
    where oid in ('public.consentimientos_whatsapp'::regclass, 'public.cola_whatsapp'::regclass) order by relname`;
  console.log(`Listo: consentimientos_whatsapp (${consentimientos} filas) y cola_whatsapp (${avisos} filas).`);
  for (const t of rls) console.log(`  ${t.relname}: RLS ${t.rls ? "activado" : "DESACTIVADO: corré pnpm db:rls"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
