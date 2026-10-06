import type { Metadata } from "next";
import { VerifTarjeta } from "@/components/backoffice/verif-tarjeta";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { PaginacionLista } from "@/components/institucion/paginacion-lista";
import { BotonLink } from "@/components/ui/button";
import { Pestanas } from "@/components/ui/pestanas";
import { requerirUsuario } from "@/lib/auth";
import { colaVerificacion, type EstadoCola } from "@/lib/queries/backoffice-docentes";

export const metadata: Metadata = { title: "Verificación" };
// DNI, CUIL y enlaces firmados a documentos: nada de esta pantalla se cachea.
export const dynamic = "force-dynamic";

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const ESTADOS: EstadoCola[] = ["todos", "pendiente", "correccion"];
const hrefCola = (estado: EstadoCola, pagina = 1) => {
  const p = new URLSearchParams();
  if (estado !== "todos") p.set("estado", estado);
  if (pagina > 1) p.set("pagina", String(pagina));
  const qs = p.toString();
  return `/backoffice/verificacion${qs ? `?${qs}` : ""}`;
};

export default async function VerificacionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya exige rol admin, pero Next puede renderizar una página sin volver a renderizar su layout (navegación parcial): se repite acá.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const estado = ESTADOS.find((e) => e === uno(sp.estado)) ?? "todos";
  const pagina = Math.max(1, Number.parseInt(uno(sp.pagina) || "1", 10) || 1);

  const cola = await colaVerificacion({ estado, pagina });

  return (
    <>
      <EncabezadoPagina
        titulo="Verificación"
        bajada="Docentes con el alta completa esperando que revisemos su identidad y sus antecedentes. Los más antiguos van primero."
      />

      <Pestanas
        className="mb-4"
        activa={estado}
        items={[
          { clave: "todos", etiqueta: "Toda la cola", cantidad: cola.cantidades.todos, href: hrefCola("todos") },
          { clave: "pendiente", etiqueta: "En cola", cantidad: cola.cantidades.pendiente, href: hrefCola("pendiente") },
          { clave: "correccion", etiqueta: "Corrección pedida", cantidad: cola.cantidades.correccion, href: hrefCola("correccion") },
        ]}
      />

      {cola.items.length === 0 ? (
        <EstadoVacio
          titulo={cola.cantidades.todos === 0 ? "No hay nadie esperando verificación" : "No hay perfiles en este estado"}
          texto={
            cola.cantidades.todos === 0
              ? "Cuando un docente termine su alta con la documentación, aparece acá para que lo revises."
              : "Probá con otra pestaña para ver el resto de la cola."
          }
          accion={
            cola.cantidades.todos === 0 ? (
              <BotonLink href="/backoffice/docentes" variante="secundario">
                Ver todos los docentes
              </BotonLink>
            ) : (
              <BotonLink href={hrefCola("todos")} variante="secundario">
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

      <PaginacionLista pagina={cola.pagina} paginas={cola.paginas} hrefDe={(n) => hrefCola(estado, n)} />
    </>
  );
}
