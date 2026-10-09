import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { certificadoDe } from "@/components/docente/curso-historial";
import { etiquetaFechas } from "@/lib/fechas-curso";
import type { pendientesDePerfil } from "@/lib/perfil";
import type { CursoHistorial } from "@/lib/queries/cursos";
import { cn } from "@/lib/utils";

/* Piezas de "Mi perfil" que no tienen estado: se renderizan en el servidor y entran al formulario como `children`/props. */

export type EstadoDocumento = "verificado" | "revision" | "sin";

/** Lo que el perfil ofrece para cargar o corregir la documentación de verificación (se arma en la página). */
export type DocumentacionPerfil = {
  dni: { estado: EstadoDocumento; detalle: string; editable: boolean };
  /** Título o certificación: lo ve quien se recibió (o quien ya lo había subido). */
  credencial: { nombre: string; estado: EstadoDocumento; detalle: string; editable: boolean };
  /** Constancia de alumno regular: la ve quien todavía estudia, en lugar del título. */
  constancia: { estado: EstadoDocumento; detalle: string; editable: boolean };
  /** Se puede cambiar "Estoy estudiando" / "Ya me recibí" y el porcentaje (no con la verificación rechazada, ni si ya está verificado como recibido). */
  estudiosEditables: boolean;
};

/** Estado de cada requisito de verificación (se arma en la página con lo que hay en la base). */
export type RequisitoVerificacion = { clave: string; nombre: string; opcional?: boolean; estado: EstadoDocumento };

const PUNTO: Record<EstadoDocumento, { clase: string; texto: string }> = {
  verificado: { clase: "bg-verde text-white", texto: "verificado" },
  revision: { clase: "bg-[#FDF1C7] text-[#7A5900]", texto: "en revisión" },
  sin: { clase: "bg-[#F0EFEA] text-sutil", texto: "sin cargar" },
};

export function PerfilVerificacion({ requisitos }: { requisitos: RequisitoVerificacion[] }) {
  return (
    <div className="mt-5 rounded-lg border border-borde bg-[#FAFAF8] px-[18px] py-4">
      <EtiquetaSeccion className="mb-3">Estado de verificación</EtiquetaSeccion>
      <ul className="m-0 flex list-none flex-wrap gap-x-[26px] gap-y-2.5 p-0 text-[13px] leading-none">
        {requisitos.map((r) => {
          const p = PUNTO[r.estado];
          return (
            <li key={r.clave} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("inline-flex size-[18px] flex-none items-center justify-center rounded-full text-[11px] font-bold", p.clase)}
              >
                {r.estado === "verificado" ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : r.estado === "revision" ? (
                  "…"
                ) : null}
              </span>
              <span>
                {r.nombre}
                {r.opcional && <span className="text-sutil"> (optativo)</span>}
                <span className="sr-only">: {p.texto}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Aside: porcentaje de perfil completo y lo que falta. */
export function PerfilCompletitud({ perfil }: { perfil: ReturnType<typeof pendientesDePerfil> }) {
  const { pendientes, porcentaje } = perfil;
  const completo = pendientes.length === 0;
  const tono = completo ? { fondo: "bg-verde-tint", texto: "text-verde", pista: "bg-verde/15", barra: "bg-verde" } : { fondo: "bg-rosa-tint", texto: "text-rosa", pista: "bg-rosa/15", barra: "bg-rosa" };
  return (
    <section className={cn("rounded-lg p-4", tono.fondo)}>
      <div className="mb-2 flex justify-between">
        <span className={cn("text-[13px] leading-none font-semibold", tono.texto)}>
          {completo ? "Tu perfil está completo" : "Completá tu perfil"}
        </span>
        <span className={cn("text-xs leading-none font-semibold", tono.texto)}>{porcentaje}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Perfil completo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        className={cn("mb-2.5 h-1.5 overflow-hidden rounded-full", tono.pista)}
      >
        <div className={cn("h-1.5", tono.barra)} style={{ width: `${porcentaje}%` }} />
      </div>
      {completo ? (
        <p className={cn("m-0 text-[13px] leading-normal", tono.texto)}>
          Con DNI y título verificados entrás en las búsquedas que piden “solo verificados”.
        </p>
      ) : (
        <ul className={cn("m-0 list-disc pl-[18px] text-[13px] leading-normal", tono.texto)}>
          {pendientes.slice(0, 5).map((p) => (
            <li key={p.clave}>{p.etiqueta}</li>
          ))}
          {pendientes.length > 5 && <li>y {pendientes.length - 5} más</li>}
        </ul>
      )}
    </section>
  );
}

/** "Cursos hechos en UNIDOAR": las inscripciones del docente, tal como las ven las instituciones. */
export function PerfilCursosHechos({ cursos }: { cursos: CursoHistorial[] }) {
  return (
    <Tarjeta como="section" className="mb-4 p-[22px]">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <h2 className="m-0 text-[15px] leading-none font-semibold">Cursos hechos en UNIDOAR</h2>
        <Link href="/docente/cursos?vista=historial" className="text-[13px] leading-none font-medium text-navy-700 hover:underline">
          Ver todos
        </Link>
      </div>
      <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">Las instituciones ven esto cuando revisan tu perfil.</p>
      {cursos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hiciste ningún curso"
          texto="Los cursos en los que te inscribas aparecen acá y suman a tu perfil."
          accion={<BotonLink href="/docente/cursos" variante="secundario" tamano="sm">Ver cursos</BotonLink>}
          className="px-4 py-6"
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {cursos.slice(0, 6).map((c) => {
            const cert = certificadoDe(c);
            const hecho = c.estado === "completado";
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-borde px-3.5 py-3">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-[30px] flex-none items-center justify-center rounded-[7px]",
                    hecho ? "bg-verde-tint text-verde" : "bg-[#F0EFEA] text-apagado",
                  )}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
                    <path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
                  </svg>
                </span>
                <div className="min-w-0 flex-[1_1_180px]">
                  <div className="text-[13.5px] leading-[1.3] font-semibold">{c.titulo}</div>
                  <div className="text-xs leading-[1.4] text-apagado">
                    {c.institucion.nombre} · {etiquetaFechas(c.fechaInicio, c.fechaFinal)}
                  </div>
                </div>
                <Insignia tono={hecho ? "verde" : "neutro"} className="flex-none">
                  {hecho ? "Completado" : c.estado === "por-empezar" ? "Por empezar" : c.estado === "finalizado" ? "Finalizó" : "En curso"}
                </Insignia>
                <span className={cn("flex-none text-[12.5px] leading-none font-medium", cert.clase)}>
                  {c.certificadoEnviado ? "Certificado enviado" : c.certifica ? "Certifica" : "Sin certificado"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
