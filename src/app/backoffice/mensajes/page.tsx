import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { MsjAtendido } from "@/components/backoffice/msj-atendido";
import { PaginacionLista } from "@/components/institucion/paginacion-lista";
import { botonClases } from "@/components/ui/button";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { fechaHoraCorta } from "@/lib/calendario";
import { haceTiempo } from "@/lib/fechas";
import { FILTROS_MENSAJES, listarMensajes, type FiltroMensajes } from "@/lib/queries/backoffice-mensajes";
import { iniciales } from "@/lib/utils";

export const metadata: Metadata = { title: "Mensajes · Backoffice" };
export const dynamic = "force-dynamic";

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** El mensaje no va en el mailto: las URL largas se cortan y la persona ya lo tiene a la vista. */
function enlaceDeRespuesta(email: string, nombre: string) {
  const asunto = encodeURIComponent("Re: tu consulta a UNIDOAR");
  const cuerpo = encodeURIComponent(`Hola ${nombre.trim().split(/\s+/)[0] ?? ""},\n\nGracias por escribirnos.\n\n`);
  return `mailto:${encodeURIComponent(email)}?subject=${asunto}&body=${cuerpo}`;
}

export default async function MensajesBackoffice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const filtro: FiltroMensajes = FILTROS_MENSAJES.find((f) => f.clave === uno(sp.estado))?.clave ?? "pendientes";
  const pagina = Number.parseInt(uno(sp.pagina), 10);
  const { mensajes, pagina: actual, paginas, cantidades } = await listarMensajes(filtro, Number.isFinite(pagina) ? pagina : 1);
  const ahora = new Date();

  return (
    <>
      <EncabezadoPagina
        titulo="Mensajes"
        bajada="Consultas que llegan desde el formulario de contacto del sitio, de la más nueva a la más vieja."
      />
      <Pestanas
        className="mb-4"
        activa={filtro}
        items={FILTROS_MENSAJES.map((f) => ({
          clave: f.clave,
          etiqueta: f.etiqueta,
          cantidad: cantidades[f.clave],
          href: `/backoffice/mensajes?estado=${f.clave}`,
        }))}
      />

      {mensajes.length === 0 ? (
        <EstadoVacio
          titulo={
            filtro === "pendientes"
              ? cantidades.todos === 0
                ? "Todavía no llegó ningún mensaje"
                : "No hay mensajes sin atender"
              : "No hay mensajes en esta lista"
          }
          texto={
            filtro === "pendientes" && cantidades.todos > 0
              ? "Todo lo que llegó ya está atendido."
              : "Cuando alguien escriba desde la página de contacto, lo vas a ver acá."
          }
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {mensajes.map((m) => (
            <Tarjeta como="li" key={m.id} className="p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar iniciales={iniciales(m.nombre)} tamano={38} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] leading-tight font-semibold [overflow-wrap:anywhere]">{m.nombre}</span>
                      <Insignia tono="azul">{m.rol}</Insignia>
                      {m.atendido && <Insignia tono="verde">Atendido</Insignia>}
                    </div>
                    <div className="mt-0.5 text-[13px] leading-snug text-apagado [overflow-wrap:anywhere]">{m.email}</div>
                  </div>
                </div>
                <div className="text-right text-xs leading-snug text-sutil">
                  {fechaHoraCorta(m.creadoEn)}
                  <span className="block">{haceTiempo(m.creadoEn, ahora)}</span>
                </div>
              </div>
              <p className="mx-0 mt-3.5 mb-0 text-sm leading-[1.6] whitespace-pre-line text-tinta-2 [overflow-wrap:anywhere]">{m.mensaje}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a href={enlaceDeRespuesta(m.email, m.nombre)} className={botonClases({ variante: "primario", tamano: "sm" })}>
                  Responder por mail
                </a>
                <MsjAtendido mensajeId={m.id} atendido={m.atendido} />
              </div>
            </Tarjeta>
          ))}
        </ul>
      )}

      <PaginacionLista
        pagina={actual}
        paginas={paginas}
        hrefDe={(p) => `/backoffice/mensajes?estado=${filtro}${p > 1 ? `&pagina=${p}` : ""}`}
      />
    </>
  );
}
