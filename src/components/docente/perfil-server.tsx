import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { AnilloMatch } from "@/components/app/anillo-match";
import { certificadoDe } from "@/components/docente/curso-historial";
import { etiquetaFechas } from "@/lib/fechas-curso";
import type { pendientesDePerfil } from "@/lib/perfil";
import type { CursoHistorial } from "@/lib/queries/cursos";
import { cn } from "@/lib/utils";
import { Icono } from "@/components/icons";

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
  verificado: { clase: "bg-verde text-white", texto: "Verificado" },
  revision: { clase: "bg-[#FDF1C7] text-[#7A5900]", texto: "En revisión" },
  sin: { clase: "bg-white text-apagado border border-linea", texto: "Sin cargar" },
};

/** Resumen de la verificación: cada requisito con su estado, como pasos. */
export function PerfilVerificacion({ requisitos }: { requisitos: RequisitoVerificacion[] }) {
  const listos = requisitos.filter((r) => !r.opcional && r.estado === "verificado").length;
  const obligatorios = requisitos.filter((r) => !r.opcional).length;
  return (
    <div className="mb-1 flex flex-col gap-3">
      <div
        role="progressbar"
        aria-label="Requisitos de verificación cumplidos"
        aria-valuemin={0}
        aria-valuemax={obligatorios}
        aria-valuenow={listos}
        className="flex gap-1.5"
      >
        {requisitos
          .filter((r) => !r.opcional)
          .map((r) => (
            <span
              key={r.clave}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                r.estado === "verificado" ? "bg-verde" : r.estado === "revision" ? "bg-[#F2C94C]" : "bg-linea",
              )}
            />
          ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-[13px] leading-none">
        {requisitos.map((r) => {
          const p = PUNTO[r.estado];
          return (
            <li key={r.clave} className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[#F7F6F2] py-1 pr-3 pl-1">
              <span aria-hidden className={cn("inline-flex size-6 flex-none items-center justify-center rounded-full text-[11px] font-bold", p.clase)}>
                {r.estado === "verificado" ? (
                  <Icono nombre="tilde" tamano={12} trazo={3} />
                ) : r.estado === "revision" ? (
                  "…"
                ) : null}
              </span>
              <span className="font-medium text-tinta">
                {r.nombre}
                {r.opcional && <span className="font-normal text-apagado"> · optativo</span>}
                <span className="sr-only">: {p.texto}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A qué sección del formulario lleva cada cosa que falta. */
const SECCION_DE: Record<string, string> = {
  foto: "datos",
  zonas: "datos",
  telefono: "contacto",
  resumen: "resumen",
  experiencia: "experiencia",
  formacion: "formacion",
  asignaturas: "asignaturas",
  niveles: "asignaturas",
  disponibilidad: "disponibilidad",
  cv: "cv",
  verificacion: "documentacion",
};

/** Aside: porcentaje de perfil completo y lo que falta, cada cosa con un enlace a su sección. */
export function PerfilCompletitud({ perfil }: { perfil: ReturnType<typeof pendientesDePerfil> }) {
  const { pendientes, porcentaje } = perfil;
  const completo = pendientes.length === 0;
  return (
    <section className="rounded-panel bg-white p-5 shadow-tarjeta">
      <div className="mb-4 flex items-center gap-4">
        <AnilloMatch
          porcentaje={porcentaje}
          tamano={72}
          color={completo ? "var(--color-verde)" : "var(--color-rosa)"}
          fondo={completo ? "var(--color-verde-tint)" : "var(--color-rosa-tint)"}
        />
        <div className="min-w-0">
          <h2 className="font-display m-0 text-[17px] leading-tight font-semibold text-navy-900">
            {completo ? "Tu perfil está completo" : "Completá tu perfil"}
          </h2>
          <p className="m-0 mt-1 text-[12.5px] leading-snug text-apagado">
            {completo
              ? "Con DNI y título verificados entrás en las búsquedas que piden “solo verificados”."
              : pendientes.length === 1
                ? "Te falta una cosa."
                : `Te faltan ${pendientes.length} cosas.`}
          </p>
        </div>
      </div>
      {!completo && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {pendientes.slice(0, 6).map((p) => (
            <li key={p.clave}>
              <a
                href={`#${SECCION_DE[p.clave] ?? "datos"}`}
                className="group flex min-h-10 items-center gap-2.5 rounded-[12px] px-2.5 text-[13.5px] leading-snug font-medium text-tinta hover:bg-rosa-tint hover:text-rosa"
              >
                <span aria-hidden className="size-4 flex-none rounded-full border-[1.5px] border-dashed border-[#C9C6C0] group-hover:border-rosa" />
                <span className="min-w-0 flex-1">{p.etiqueta}</span>
                <span aria-hidden className="text-apagado group-hover:text-rosa">›</span>
              </a>
            </li>
          ))}
          {pendientes.length > 6 && <li className="px-2.5 pt-1 text-[12.5px] text-apagado">y {pendientes.length - 6} más</li>}
        </ul>
      )}
    </section>
  );
}

/** "Cursos hechos en UNIDOAR": las inscripciones del docente, tal como las ven las instituciones. */
export function PerfilCursosHechos({ cursos }: { cursos: CursoHistorial[] }) {
  return (
    <Tarjeta como="section" className="rounded-panel border-0 p-6 shadow-tarjeta">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <h2 className="font-display m-0 text-[18px] leading-tight font-semibold text-navy-900">Cursos hechos en UNIDOAR</h2>
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
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-interno bg-[#F7F6F2] px-4 py-3">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-[30px] flex-none items-center justify-center rounded-[7px]",
                    hecho ? "bg-verde-tint text-verde" : "bg-[#F0EFEA] text-apagado",
                  )}
                >
                  <Icono nombre="birrete" tamano={15} trazo={1.8} />
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
