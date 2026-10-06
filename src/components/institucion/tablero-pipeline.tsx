"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";
import { descartarPostulacion, moverPostulacion } from "@/app/actions/pipeline";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CajonPostulante } from "@/components/institucion/cajon-postulante";
import { TarjetaPostulante } from "@/components/institucion/tarjeta-postulante";
import { Boton, BotonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/campos";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { useToast } from "@/components/ui/toast";
import type { EtapaPostulacion } from "@/db/schema";
import { ETAPAS } from "@/lib/catalogo";
import {
  COLOR_ETAPA,
  ETAPA_MENU,
  etiquetaDias,
  INSIGNIA_ETAPA,
  type BusquedaPipeline,
  type PostulanteTarjeta,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type Orden = "recientes" | "antiguos" | "nombre";
type Movimiento = { id: string; etapa: EtapaPostulacion; ahora: string };

const COLUMNA_VACIA: Record<EtapaPostulacion, string> = {
  nuevos: "Acá aparecen quienes se postulan a tu búsqueda.",
  preseleccionados: "Arrastrá acá a quienes quieras tener a mano.",
  entrevista: "Arrastrá acá a quienes vayas a entrevistar.",
  oferta: "Arrastrá una tarjeta acá cuando mandes la oferta.",
  contratado: "Todavía nadie. Cuando confirmes una contratación, la persona queda acá.",
  descartado: "",
};

const COMPARAR: Record<Orden, (a: PostulanteTarjeta, b: PostulanteTarjeta) => number> = {
  recientes: (a, b) => b.etapaDesde.localeCompare(a.etapaDesde),
  antiguos: (a, b) => a.etapaDesde.localeCompare(b.etapaDesde),
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
};

/**
 * Pipeline de una búsqueda: Kanban (con drag & drop y menú por tarjeta) o tabla, filtros en
 * memoria y cajón con la ficha. Los movimientos son optimistas: la tarjeta cambia de columna al
 * soltar y, si la acción falla, vuelve sola a su lugar y se muestra el error.
 */
export function TableroPipeline({
  busqueda,
  postulantes,
  vista,
  barra,
}: {
  busqueda: BusquedaPipeline;
  postulantes: PostulanteTarjeta[];
  vista: "kanban" | "tabla";
  /** Acciones que resuelve el servidor (cerrar/reabrir, editar, cambiar de vista). */
  barra: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const soloLectura = busqueda.estado === "cerrada";

  const [lista, moverLocal] = useOptimistic(postulantes, (estado: PostulanteTarjeta[], m: Movimiento) =>
    estado.map((p) => (p.id === m.id ? { ...p, etapa: m.etapa, dias: 0, etapaDesde: m.ahora } : p)),
  );

  const [soloVerificados, setSoloVerificados] = useState(false);
  const [zona, setZona] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EtapaPostulacion | null>(null);

  const mover = (id: string, etapa: EtapaPostulacion) => {
    if (soloLectura) return;
    const p = lista.find((x) => x.id === id);
    if (!p || p.etapa === etapa) return;
    // Contratar tiene su propia confirmación (fecha de inicio y cierre de la búsqueda).
    if (etapa === "contratado") {
      router.push(`/institucion/contratar?postulacion=${id}`);
      return;
    }
    startTransition(async () => {
      moverLocal({ id, etapa, ahora: new Date().toISOString() });
      try {
        const r = etapa === "descartado" ? await descartarPostulacion(id) : await moverPostulacion(id, etapa);
        if (!r.ok) toast(r.error, "error");
        else toast(etapa === "descartado" ? `${p.nombre} salió del proceso.` : `${p.nombre} pasó a ${ETAPA_MENU[etapa]}.`);
      } catch {
        // Al terminar la transición la tarjeta vuelve sola a su columna.
        toast("No pudimos mover la postulación. Probá de nuevo.", "error");
      }
    });
  };

  const zonas = [...new Set(lista.flatMap((p) => p.zonas))].sort((a, b) => a.localeCompare(b, "es"));
  const visibles = lista
    .filter((p) => p.etapa !== "descartado")
    .filter((p) => !soloVerificados || p.cv.verificado)
    .filter((p) => !zona || p.zonas.includes(zona))
    .sort(COMPARAR[orden]);
  const descartados = lista.filter((p) => p.etapa === "descartado");
  const seleccionado = lista.find((p) => p.id === abiertoId) ?? null;

  if (lista.length === 0) {
    return (
      <>
        <div className="mb-5 flex flex-wrap items-center gap-2">{barra}</div>
        <EstadoVacio
          titulo="Todavía no hay postulantes"
          texto="Cuando alguien se postule o acepte tu invitación, aparece acá. Mientras tanto, podés buscar profesionales y invitarlos a postularse."
          accion={
            <BotonLink href="/institucion/buscar-docentes" variante="primario">
              Buscar profesionales
            </BotonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <div className="w-[160px] flex-none max-[1100px]:min-w-[140px] max-[1100px]:flex-1">
          <Select
            aria-label="Verificación"
            value={soloVerificados ? "verificados" : "todos"}
            onChange={(e) => setSoloVerificados(e.target.value === "verificados")}
          >
            <option value="todos">Todos</option>
            <option value="verificados">Solo verificados</option>
          </Select>
        </div>
        {zonas.length > 0 && (
          <div className="w-[170px] flex-none max-[1100px]:min-w-[140px] max-[1100px]:flex-1">
            <Select aria-label="Zona" value={zona} onChange={(e) => setZona(e.target.value)}>
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-[190px] flex-none max-[1100px]:min-w-[140px] max-[1100px]:flex-1">
          <Select aria-label="Ordenar" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="recientes">Ordenar: más recientes</option>
            <option value="antiguos">Más tiempo en la etapa</option>
            <option value="nombre">Nombre A-Z</option>
          </Select>
        </div>
        {barra}
      </div>

      {soloLectura ? (
        <p className="mt-2 mb-5 rounded-lg bg-verde-tint px-3.5 py-2.5 text-[13px] leading-normal text-verde">
          Esta búsqueda está cerrada: podés ver a los postulantes y sus fichas, pero no moverlos. Reabrila para seguir el proceso.
        </p>
      ) : (
        <p className="mt-2 mb-5 text-[13px] leading-normal text-sutil">
          {vista === "kanban"
            ? "Arrastrá una tarjeta o usá el menú ⋯ para cambiarla de etapa · hacé clic en el nombre para abrir la ficha."
            : "Cambiá la etapa desde el selector de cada fila · hacé clic en el nombre para abrir la ficha."}
        </p>
      )}

      {vista === "kanban" ? (
        <div className="flex gap-3.5 overflow-x-auto pb-1.5">
          {ETAPAS.map((col) => {
            const items = visibles.filter((p) => p.etapa === col.key);
            return (
              <section
                key={col.key}
                aria-label={col.columna}
                onDragOver={(e) => {
                  if (soloLectura) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setSobre(col.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || arrastrandoId;
                  setSobre(null);
                  setArrastrandoId(null);
                  if (id) mover(id, col.key);
                }}
                className={cn(
                  "min-h-[140px] min-w-[200px] flex-1 rounded-[10px] bg-superficie p-3 transition-shadow",
                  sobre === col.key && "ring-2 ring-navy-700/40",
                )}
              >
                <h2 className="m-0 mb-3 flex items-center gap-1.5 text-[13px] leading-none font-semibold text-tinta">
                  <span className={cn("size-[7px] rounded-full", COLOR_ETAPA[col.key])} />
                  {col.columna}
                  <span className="ml-auto font-normal text-sutil">{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <div className="rounded-[10px] border-[1.5px] border-dashed border-borde px-2 py-4 text-center text-xs leading-normal text-sutil">
                    {COLUMNA_VACIA[col.key]}
                  </div>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {items.map((p) => (
                      <TarjetaPostulante
                        key={p.id}
                        p={p}
                        soloLectura={soloLectura}
                        arrastrando={arrastrandoId === p.id}
                        onAbrir={() => setAbiertoId(p.id)}
                        onMover={(etapa) => mover(p.id, etapa)}
                        onDescartar={() => mover(p.id, "descartado")}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", p.id);
                          e.dataTransfer.effectAllowed = "move";
                          setArrastrandoId(p.id);
                        }}
                        onDragEnd={() => {
                          setArrastrandoId(null);
                          setSobre(null);
                        }}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : visibles.length === 0 ? (
        <EstadoVacio titulo="Ningún postulante coincide con los filtros" texto="Probá con otra zona o mostrando también a los que no están verificados." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Postulante</th>
              <th>Detalle</th>
              <th>Etapa</th>
              <th>En la etapa</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id}>
                <td>
                  <button
                    type="button"
                    onClick={() => setAbiertoId(p.id)}
                    className="flex items-center gap-2.5 rounded-md text-left font-semibold focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
                  >
                    <Avatar iniciales={p.iniciales} fotoUrl={p.fotoUrl} tamano={28} />
                    {p.nombre}
                  </button>
                </td>
                <td className="text-apagado">{p.subtitulo}</td>
                <td>
                  <div className="w-[190px]">
                    <Select
                      aria-label={`Etapa de ${p.nombre}`}
                      value={p.etapa}
                      disabled={soloLectura}
                      onChange={(e) => mover(p.id, e.target.value as EtapaPostulacion)}
                      className="py-2 text-[13px]"
                    >
                      {[...ETAPAS.map((e) => e.key), "descartado" as const].map((e) => (
                        <option key={e} value={e}>
                          {ETAPA_MENU[e]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </td>
                <td className="whitespace-nowrap text-apagado">{etiquetaDias(p.etapa, p.dias)}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      {descartados.length > 0 && (
        <details className="mt-5 rounded-ud border border-borde bg-white">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-apagado">
            Descartados · {descartados.length}
          </summary>
          <ul className="m-0 flex list-none flex-col p-0">
            {descartados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-t border-borde px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setAbiertoId(p.id)}
                  className="flex min-w-0 items-center gap-2.5 rounded-md text-left text-[13px] font-medium text-apagado focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
                >
                  <Avatar iniciales={p.iniciales} fotoUrl={p.fotoUrl} tamano={28} />
                  <span className="truncate">{p.nombre}</span>
                  <Insignia tono={INSIGNIA_ETAPA.descartado.tono}>Descartado</Insignia>
                </button>
                {!soloLectura && (
                  <Boton variante="secundario" tamano="sm" onClick={() => mover(p.id, "nuevos")}>
                    Recuperar
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <CajonPostulante
        postulante={seleccionado}
        busquedaId={busqueda.id}
        soloLectura={soloLectura}
        onCerrar={() => setAbiertoId(null)}
        onMover={mover}
      />
    </>
  );
}
