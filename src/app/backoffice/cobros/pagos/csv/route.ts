import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { hoyAR } from "@/lib/cobros";
import { csvDePagos, leerFiltrosDePagos, nombreDelCsv } from "@/lib/pagos-reporte";
import { pagosDelReporte } from "@/lib/queries/backoffice-pagos";
import { planes } from "@/lib/queries/planes";

export const dynamic = "force-dynamic";

/**
 * Descarga el reporte de pagos (Cobros → Pagos) como CSV con los mismos filtros de la pantalla (`?desde=&hasta=&medio=&q=&ejemplo=1`). Es una ruta
 * aparte del layout del backoffice: ahí no corre `requerirUsuario`, así que se exige el rol admin acá mismo. Lleva CUIT y montos de las
 * instituciones: sin sesión de admin no hay nada que ver (404, como si no existiera) y nunca se guarda en caché.
 */
export async function GET(request: Request) {
  const usuario = await usuarioActual();
  if (usuario?.rol !== "admin") return new NextResponse("No encontrado", { status: 404 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filtros = leerFiltrosDePagos(sp, hoyAR());
  const [pagos, P] = await Promise.all([pagosDelReporte(filtros), planes()]);
  const csv = csvDePagos(pagos, (clave) => P.nombreDePlan(clave));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreDelCsv(filtros)}"`,
      "Cache-Control": "no-store",
    },
  });
}
