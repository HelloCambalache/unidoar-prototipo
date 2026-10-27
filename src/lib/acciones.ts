import type { ZodType } from "zod";

/** Resultado uniforme de las server actions: la UI solo mira `ok`. */
export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; campos?: Record<string, string>; codigo?: string };

export function ok(): { ok: true };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T) {
  return data === undefined ? { ok: true as const } : { ok: true as const, data };
}

/**
 * Un fallo. `codigo` es opcional: lo usa la pantalla para reaccionar a un caso puntual además de mostrar el mensaje (hoy, `plan-inactivo`
 * abre el popup de pago: ver src/lib/plan-activo.ts).
 */
export function fallo(error: string, campos?: Record<string, string>, codigo?: string) {
  return codigo ? { ok: false as const, error, campos, codigo } : { ok: false as const, error, campos };
}

/**
 * Valida un FormData (o un objeto plano) con Zod y devuelve los errores por campo,
 * listos para mostrar debajo de cada input.
 */
export function parsear<T>(schema: ZodType<T>, entrada: FormData | Record<string, unknown>) {
  const crudo = entrada instanceof FormData ? Object.fromEntries(entrada.entries()) : entrada;
  const r = schema.safeParse(crudo);
  if (r.success) return { ok: true as const, data: r.data };
  const campos: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const clave = String(issue.path[0] ?? "_");
    campos[clave] ??= issue.message;
  }
  return { ok: false as const, error: "Revisá los campos marcados.", campos };
}
