import { NextResponse } from "next/server";
import { z } from "zod";
import { sesionActual } from "@/lib/auth";
import { buscarUbicaciones, permitirConsulta } from "@/lib/queries/ubicacion";
import { firmarUbicacion, zonaDeUbicacion } from "@/lib/ubicacion";

/**
 * Sugerencias de ubicación para una dirección escrita a mano (la usan los formularios que piden una dirección).
 * `proposito` decide a dónde puede viajar el texto: el domicilio de una persona ("docente") solo se consulta en
 * Georef (API oficial del Estado); las direcciones de instituciones y cursos, que son públicas, también en OpenStreetMap.
 * Cada sugerencia vuelve con una firma: es lo que el formulario manda al guardar para que el servidor no tenga que
 * creerle coordenadas al navegador. No se devuelven coordenadas sueltas.
 */

const entrada = z.object({
  q: z.string().trim().min(5).max(200),
  proposito: z.enum(["institucion", "curso", "docente"]).default("institucion"),
});

const responder = (cuerpo: unknown, status = 200) => NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const sesion = await sesionActual();
  if (!sesion) return responder({ resultados: [], error: "Iniciá sesión para buscar direcciones." }, 401);

  const { searchParams } = new URL(req.url);
  const datos = entrada.safeParse({ q: searchParams.get("q") ?? "", proposito: searchParams.get("proposito") ?? undefined });
  if (!datos.success) return responder({ resultados: [] });
  if (!permitirConsulta(sesion.id)) return responder({ resultados: [], error: "Hiciste muchas búsquedas seguidas. Esperá un momento." }, 429);

  const { q, proposito } = datos.data;
  const lista = await buscarUbicaciones({ texto: q, osm: proposito !== "docente" });
  const resultados = lista.flatMap((u) => {
    const token = firmarUbicacion(u, q);
    if (!token) return [];
    const { etiqueta, calle, partido, provincia, localidad, exacta, fuente, coincide } = u;
    return [{ etiqueta, calle, partido, provincia, localidad, zona: zonaDeUbicacion(u), exacta, fuente, coincide, token }];
  });
  return responder({ resultados });
}
