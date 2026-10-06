/*
 * Variables de Supabase. Los accesos son literales (process.env.NEXT_PUBLIC_…) a propósito:
 * Next solo reemplaza esas variables en el navegador si aparecen escritas tal cual.
 *
 * La integración de Vercel y el panel de Supabase nombran la clave pública de dos
 * maneras según la antigüedad del proyecto (anon key / publishable key): se aceptan ambas.
 */

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function supabaseClavePublica() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export function supabaseConfigurado() {
  return Boolean(supabaseUrl() && supabaseClavePublica());
}

/** Igual que supabaseConfigurado() pero lanza un error legible si falta algo. */
export function requerirSupabase() {
  const url = supabaseUrl();
  const clave = supabaseClavePublica();
  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Instalá Supabase desde Vercel (vercel integration add supabase) y corré `vercel env pull .env.local --yes`.",
    );
  }
  return { url, clave };
}
