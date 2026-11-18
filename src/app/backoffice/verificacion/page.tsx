import type { Metadata } from "next";
import Link from "next/link";
import { VerifBuscador } from "@/components/backoffice/verif-buscador";
import { VerifTarjeta } from "@/components/backoffice/verif-tarjeta";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { PaginacionLista } from "@/components/institucion/paginacion-lista";
import { BotonLink } from "@/components/ui/button";
import { Pestanas } from "@/components/ui/pestanas";
import { requerirUsuario } from "@/lib/auth";
import { ORDENES_COLA, leerEstadoCola, leerOrdenCola, type EstadoCola, type OrdenCola } from "@/lib/backoffice-docentes";
import { colaVerificacion } from "@/lib/queries/backoffice-docentes";

export const metadata: Metadata = { title: "Verificación" };
// DNI, CUIL y enlaces firmados a documentos: nada de esta pantalla se cachea.
export const dynamic = "force-dynamic";

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const hrefCola = (estado: EstadoCola, q: string, orden: OrdenCola, pagina = 1) => {
  const p = new URLSearchParams();
  if (estado !== "todos") p.set("estado", estado);
  if (q) p.set("q", q);
  if (orden !== "antiguos") p.set("orden", orden);
  if (pagina > 1) p.set("pagina", String(pagina));
  const qs = p.toString();
  return `/backoffice/verificacion${qs ? `?${qs}` : ""}`;
};

export default async function VerificacionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya exige rol admin, pero Next puede renderizar una página sin volver a renderizar su layout (navegación parcial): se repite acá.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const estado = leerEstadoCola(uno(sp.estado));
  const q = uno(sp.q).trim().slice(0, 80);
  const orden = leerOrdenCola(uno(sp.orden));
  const pagina = Math.max(1, Number.parseInt(uno(sp.pagina) || "1", 10) || 1);

  const cola = await colaVerificacion({ estado, pagina, q, orden });

  return (
    <>
      <EncabezadoPagina
        titulo="Verificación"
        bajada={`Profesionales que subieron su documentación y esperan que revisemos su identidad y sus antecedentes. ${
          orden === "antiguos" ? "Los que se inscribieron primero van arriba." : "Los que se inscribieron último van arriba."
        }`}
      />

      <VerifBuscador q={q} estado={estado} orden={orden} />

      <Pestanas
        className="mb-2"
        activa={estado}
        items={[
          { clave: "todos", etiqueta: "Toda la cola", cantidad: cola.cantidades.todos, href: hrefCola("todos", q, orden) },
          { clave: "pendiente", etiqueta: "En cola", cantidad: cola.cantidades.pendiente, href: hrefCola("pendiente", q, orden) },
          { clave: "correccion", etiqueta: "Observados", cantidad: cola.cantidades.correccion, href: hrefCola("correccion", q, orden) },
          { clave: "modificados", etiqueta: "Modificados", cantidad: cola.cantidades.modificados, href: hrefCola("modificados", q, orden) },
        ]}
      />
      <nav aria-label="Orden de la cola" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-apagado">
        <span>Ordenar por fecha de inscripción:</span>
        {ORDENES_COLA.map((o) => (
          <Link
            key={o.clave}
            href={hrefCola(estado, q, o.clave)}
            aria-current={orden === o.clave ? "true" : undefined}
            className={orden === o.clave ? "font-semibold text-navy-700 underline" : "text-apagado underline-offset-2 hover:text-tinta hover:underline"}
          >
            {o.etiqueta}
          </Link>
        ))}
      </nav>
      <p className="m-0 mb-4 max-w-[78ch] text-[12.5px] leading-normal text-apagado">
        <b className="font-semibold text-tinta-2">Observados:</b> se les pidió una corrección y todavía no volvieron a subir.{" "}
        <b className="font-semibold text-tinta-2">Modificados:</b> subieron documentación después de la observación y esperan la nueva revisión.
      </p>

      {cola.sinDocumentacion > 0 && (
        <p role="status" className="mb-4 rounded-caja bg-lienzo px-3.5 py-2.5 text-[13px] leading-normal text-tinta-2">
          {cola.sinDocumentacion === 1
            ? "1 profesional completó el alta pero todavía no subió documentación"
            : `${cola.sinDocumentacion} profesionales completaron el alta pero todavía no subieron documentación`}
          : no entran a la cola hasta que la suban.{" "}
          <Link
            href={`/backoffice/docentes?verificacion=pendiente${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className="font-medium text-navy-700 underline"
          >
            Ver en Profesionales
          </Link>
        </p>
      )}

      {cola.items.length === 0 ? (
        <EstadoVacio
          titulo={
            q
              ? "No encontramos a nadie con ese nombre en la cola"
              : cola.cantidades.todos === 0
                ? "No hay nadie esperando verificación"
                : "No hay perfiles en este estado"
          }
          texto={
            q
              ? "Revisá cómo está escrito, probá con solo el apellido o buscalo en la lista de profesionales: si todavía no subió documentación, no está en la cola."
              : cola.cantidades.todos === 0
                ? "Cuando un profesional suba su documentación, aparece acá para que lo revises."
                : "Probá con otra pestaña para ver el resto de la cola."
          }
          accion={
            q ? (
              <BotonLink href={hrefCola(estado, "", orden)} variante="secundario">
                Quitar la búsqueda
              </BotonLink>
            ) : cola.cantidades.todos === 0 ? (
              <BotonLink href="/backoffice/docentes" variante="secundario">
                Ver todos los profesionales
              </BotonLink>
            ) : (
              <BotonLink href={hrefCola("todos", q, orden)} variante="secundario">
                Ver toda la cola
              </BotonLink>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {cola.items.map((item) => (
            <VerifTarjeta key={item.id} item={item} />
          ))}
        </div>
      )}

      <PaginacionLista pagina={cola.pagina} paginas={cola.paginas} hrefDe={(n) => hrefCola(estado, q, orden, n)} />
    </>
  );
}
