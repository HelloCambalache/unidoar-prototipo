/*
 * Crea (o actualiza) los buckets de Supabase Storage que usa la app:
 *
 *   publico → logos, portadas y fotos de perfil. Lectura pública por URL.
 *   privado → CV y documentos de identidad. Solo se lee con URL firmada generada en el servidor.
 *
 * Las subidas pasan siempre por el servidor (src/app/api/subir), que usa la clave de servicio.
 * Es idempotente: si el bucket existe, sincroniza sus límites.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (corré el script con dotenv: pnpm db:storage).");
  process.exit(1);
}

const supabase = createClient(url, clave, { auth: { persistSession: false } });

const IMAGENES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const BUCKETS = [
  { id: "publico", public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: IMAGENES },
  { id: "privado", public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf", ...IMAGENES] },
];

async function main() {
  for (const { id, ...opciones } of BUCKETS) {
    const { error } = await supabase.storage.createBucket(id, opciones);
    if (!error) {
      console.log(`✓ bucket "${id}" creado`);
      continue;
    }
    if (!/already exists/i.test(error.message)) throw error;
    const { error: errorUpdate } = await supabase.storage.updateBucket(id, opciones);
    if (errorUpdate) throw errorUpdate;
    console.log(`✓ bucket "${id}" ya existía: límites sincronizados`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
