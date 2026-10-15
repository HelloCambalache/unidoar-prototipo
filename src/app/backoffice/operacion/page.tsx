import type { Metadata } from "next";
import Link from "next/link";
import { OpBarrasZona } from "@/components/backoffice/op-barras-zona";
import { OpSelectorPeriodo } from "@/components/backoffice/op-selector-periodo";
import { DocTabla } from "@/components/backoffice/doc-tabla";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { TarjetaMetrica } from "@/components/app/tarjeta-metrica";
import { BotonLink } from "@/components/ui/button";
import {
  MINIMO_POSTULANTES,
  duracionDeHoras,
  enteroAR,
  leerPeriodo,
  listaLegible,
  opcionesDePeriodo,
} from "@/lib/backoffice-operacion";
import { requerirUsuario } from "@/lib/auth";
import { plural } from "@/lib/busquedas";
import { metricasOperacion } from "@/lib/queries/backoffice-operacion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Operación" };

const MAX_FLOJAS = 6;
const MAX_EN_RIESGO = 5;

const panel = "rounded-tarjeta bg-white p-6 shadow-tarjeta";
const tituloPanel = "font-display m-0 mb-0.5 text-[17px] leading-[1.3] font-semibold text-navy-900";
const bajadaPanel = "m-0 mb-4 text-[13px] leading-[1.4] text-apagado";

export default async function OperacionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya exige rol admin, pero Next puede renderizar una página sin volver a renderizar su layout (navegación parcial): se repite acá.
  await requerirUsuario("admin");
  const clave = leerPeriodo((await searchParams).periodo);
  const m = await metricasOperacion(clave);
  const { periodo, docentesActivos: activos, primeraPostulacion: primera } = m;

  const flojas = m.busquedasFlojas;
  const enRiesgo = m.institucionesEnRiesgo;

  return (
    <>
      <h1 className="font-display m-0 mb-1 text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] text-navy-900 max-[860px]:text-[24px]">Cómo viene la operación</h1>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] leading-snug text-apagado">
          {m.partidos.length > 0 ? `${listaLegible(m.partidos)} · ` : ""}
          {periodo.etiqueta.toLowerCase()}
        </p>
        <OpSelectorPeriodo actual={periodo.clave} opciones={opcionesDePeriodo()} />
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3.5 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
        <TarjetaMetrica
          etiqueta="Profesionales activos"
          valor={enteroAR(activos.total)}
          nota={
            activos.nuevosEnPeriodo > 0
              ? `+${enteroAR(activos.nuevosEnPeriodo)} ${periodo.frase}${activos.nuevosEnPeriodoAnterior > 0 ? ` (${enteroAR(activos.nuevosEnPeriodoAnterior)} en el período anterior)` : ""}`
              : `sin altas nuevas ${periodo.frase}`
          }
          notaTono={activos.nuevosEnPeriodo > 0 ? "verde" : "sutil"}
        />
        <TarjetaMetrica
          etiqueta="Primera postulación"
          valor={primera.horas != null ? duracionDeHoras(primera.horas) : "—"}
          nota={
            primera.horas != null
              ? `promedio desde la publicación (${plural(primera.busquedasMedidas, "búsqueda medida", "búsquedas medidas")})`
              : `ninguna búsqueda publicada ${periodo.frase} recibió postulaciones todavía`
          }
        />
        <TarjetaMetrica
          etiqueta="Búsquedas flojas"
          tono="naranja"
          valor={enteroAR(flojas.length)}
          nota={`con menos de ${MINIMO_POSTULANTES} postulantes tras una semana`}
        />
        <TarjetaMetrica
          etiqueta="Riesgo de no renovar"
          tono="rojo"
          valor={enteroAR(enRiesgo.length)}
          nota={`instituciones sin actividad ${periodo.frase}`}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        <section className={panel}>
          <h2 className={tituloPanel}>Profesionales por zona</h2>
          <p className={bajadaPanel}>Dónde falta oferta para las búsquedas abiertas</p>
          {m.zonas.length > 0 ? (
            <OpBarrasZona zonas={m.zonas} sinZona={m.busquedasSinZona} />
          ) : (
            <p className="m-0 text-sm leading-normal text-apagado">Todavía no hay zonas cargadas en el catálogo.</p>
          )}
        </section>

        <section className={panel}>
          <h2 className={tituloPanel}>Búsquedas para empujar por teléfono</h2>
          <p className={bajadaPanel}>Menos de {MINIMO_POSTULANTES} postulantes después de una semana</p>
          {flojas.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {flojas.slice(0, MAX_FLOJAS).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 border-b border-borde py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm leading-snug font-semibold">{b.puesto}</div>
                    <div className="text-xs leading-snug text-sutil">
                      <Link href={`/backoffice/instituciones/${b.institucionId}`} className="text-sutil hover:text-navy-700 hover:underline">
                        {b.institucion}
                      </Link>
                      {b.zona && ` · ${b.zona}`} · {plural(b.dias, "día", "días")}
                      {b.telefono && (
                        <>
                          {" · "}
                          <a href={`tel:${b.telefono.replace(/[^\d+]/g, "")}`} className="text-sutil hover:text-navy-700 hover:underline">
                            {b.telefono}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex flex-none items-center rounded-full px-2.5 py-[5px] text-xs leading-none font-semibold whitespace-nowrap",
                      b.postulantes <= 1 ? "bg-naranja-tint text-naranja-ink" : "bg-[#FDF1C7] text-[#7A5900]",
                    )}
                  >
                    {plural(b.postulantes, "postulante", "postulantes")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm leading-normal text-apagado">Ninguna búsqueda abierta se quedó corta de postulantes. Buena señal.</p>
          )}
          {flojas.length > MAX_FLOJAS && (
            <p className="m-0 mt-2 text-xs leading-normal text-sutil">y {flojas.length - MAX_FLOJAS} más con pocos postulantes.</p>
          )}
          <div className="mt-3.5 rounded-lg bg-[#F5F5F1] px-3.5 py-3 text-[13px] leading-normal text-apagado">
            {enRiesgo.length > 0 ? (
              <>
                Instituciones en riesgo de no renovar:{" "}
                {enRiesgo.slice(0, MAX_EN_RIESGO).map((i, n, vistas) => (
                  <span key={i.id}>
                    <Link href={`/backoffice/instituciones/${i.id}`} className="text-apagado underline-offset-2 hover:text-navy-700 hover:underline">
                      {i.nombre}
                    </Link>
                    {n < vistas.length - 1 ? ", " : ""}
                  </span>
                ))}
                {enRiesgo.length > MAX_EN_RIESGO && ` y ${enRiesgo.length - MAX_EN_RIESGO} más`}.
              </>
            ) : (
              `Ninguna institución sin actividad ${periodo.frase}.`
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="calidad-perfil">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="calidad-perfil" className="m-0 inline text-[15px] leading-[1.3] font-semibold">
              Profesionales por calidad de perfil
            </h2>{" "}
            <span className="text-xs leading-none text-sutil">scoring interno — nunca visible para instituciones ni profesionales</span>
          </div>
          <Link href="/backoffice/docentes" className="text-[13px] leading-none font-medium text-navy-700 hover:underline">
            Ver todos los profesionales →
          </Link>
        </div>
        {m.docentesPorScoring.length > 0 ? (
          <DocTabla filas={m.docentesPorScoring} />
        ) : (
          <EstadoVacio
            titulo="Todavía no hay profesionales con el alta completa"
            texto="Cuando los haya, acá ves quiénes tienen el perfil más sólido."
            accion={
              <BotonLink href="/backoffice/verificacion" variante="secundario">
                Ir a Verificación
              </BotonLink>
            }
          />
        )}
      </section>
    </>
  );
}
