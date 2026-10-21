import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { CursoFoto } from "@/components/docente/curso-foto";
import { Icono } from "@/components/icons";
import { lugarDeCurso } from "@/lib/cursos";
import { diaDelMes, etiquetaFechas, mesYAnio } from "@/lib/fechas-curso";
import { kmLegible } from "@/lib/geo";
import type { CursoVista } from "@/lib/queries/cursos";

const PUNTOS = "bg-[#FDF1C7] text-[#7A5900] font-semibold";

export function etiquetaPuntos(puntaje: number | null) {
  return `+${puntaje ?? 10} puntos`;
}

function resumir(texto: string | null, max = 130) {
  const t = (texto ?? "").trim();
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

function cupo(inscriptos: number) {
  return inscriptos === 0 ? "Sin anotados todavía" : inscriptos === 1 ? "1 anotado" : `${inscriptos} anotados`;
}

function Medalla() {
  return (
    <Icono nombre="medalla" tamano={11} trazo={2.2} />
  );
}

/** Tarjeta de un curso en la vista Lista. Toda la tarjeta lleva al detalle. */
export function CursoTarjeta({ c }: { c: CursoVista }) {
  return (
    <Link
      href={`/docente/cursos?curso=${c.id}`}
      className="flex flex-col overflow-hidden rounded-tarjeta border border-linea bg-white transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(31,36,33,.1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30"
    >
      <div className="relative">
        <CursoFoto url={c.fotoUrl} altura={150} />
        <Insignia tono={c.modalidad === "Online" ? "azul" : "neutro"} className="absolute top-2.5 left-2.5">
          {c.modalidad}
        </Insignia>
        {c.inscripto && (
          <Insignia tono="verde" className="absolute top-2.5 right-2.5">
            ✓ Ya te inscribiste
          </Insignia>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 text-[11.5px] leading-none font-semibold tracking-[.04em] text-sutil uppercase">
          {c.institucion.nombre}
        </div>
        <div className="mb-0.5 text-base leading-[1.3] font-semibold text-tinta">{c.titulo}</div>
        {c.subtitulo && <div className="mb-2 text-[12.5px] leading-[1.3] font-medium text-navy-700">{c.subtitulo}</div>}
        <div className="mb-3 text-[13px] leading-normal text-apagado">{resumir(c.descripcion)}</div>
        {c.certifica && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Insignia tono="verde">
              <Medalla />
              Certificado
            </Insignia>
            <Insignia className={PUNTOS}>{etiquetaPuntos(c.puntaje)}</Insignia>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-[5px] border-t border-[#F0EFEA] pt-3 text-[12.5px] leading-[1.4] text-apagado">
          <div className="flex items-center gap-1.5">
            <Icono nombre="calendario" tamano={13} trazo={1.8} className="text-sutil" />
            {etiquetaFechas(c.fechaInicio, c.fechaFinal)}
          </div>
          {c.horario && (
            <div className="flex items-center gap-1.5">
              <Icono nombre="reloj" tamano={13} trazo={1.8} className="text-sutil" />
              {c.horario}
            </div>
          )}
          <div className="flex items-start gap-1.5">
            <Icono nombre={c.modalidad === "Online" ? "videollamada" : "ubicacion"} tamano={13} trazo={1.8} className="mt-[1.5px] text-sutil" />
            <span className="min-w-0">{lugarDeCurso(c) ?? "Dirección a confirmar"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icono nombre="perfil" tamano={13} trazo={1.8} className="text-sutil" />
            {c.profesor || "A confirmar"}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2.5">
          <span className="text-[12.5px] leading-none font-medium text-sutil">{cupo(c.inscriptos)}</span>
          <span className="inline-flex items-center gap-1 text-[13px] leading-none font-semibold text-navy-700">
            Ver curso <span aria-hidden>›</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Vista Agenda: los cursos agrupados por mes de inicio. */
export function CursoAgenda({ cursos }: { cursos: CursoVista[] }) {
  const conFecha = cursos.filter((c) => c.fechaInicio).sort((a, b) => a.fechaInicio!.localeCompare(b.fechaInicio!));
  const sinFecha = cursos.filter((c) => !c.fechaInicio);
  const meses = [...new Set(conFecha.map((c) => mesYAnio(c.fechaInicio!)))];

  const fila = (c: CursoVista, dia: string) => (
    <li key={c.id}>
      <Link
        href={`/docente/cursos?curso=${c.id}`}
        className="flex flex-wrap items-center gap-3.5 rounded-tarjeta border border-linea bg-white px-4 py-3.5 transition-shadow duration-200 hover:shadow-[0_6px_16px_rgba(31,36,33,.09)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30"
      >
        <span className="font-display inline-flex size-11 flex-none items-center justify-center rounded-caja bg-[#F0EFEA] text-[17px] leading-none font-bold text-navy-700">
          {dia}
        </span>
        <div className="min-w-0 flex-[1_1_220px]">
          <div className="mb-0.5 text-[14.5px] leading-[1.3] font-semibold text-tinta">{c.titulo}</div>
          <div className="text-[12.5px] leading-[1.4] text-apagado">
            {[c.horario, lugarDeCurso(c) ?? "Presencial, dirección a confirmar", c.institucion.nombre, kmLegible(c.distanciaKm)]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {c.certifica && <Insignia className={`flex-none ${PUNTOS}`}>{etiquetaPuntos(c.puntaje)}</Insignia>}
        {c.inscripto && (
          <Insignia tono="verde" className="flex-none">
            ✓ Ya te inscribiste
          </Insignia>
        )}
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-[22px]">
      {meses.map((mes) => (
        <section key={mes}>
          <h2 className="m-0 mb-2.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">{mes}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {conFecha.filter((c) => mesYAnio(c.fechaInicio!) === mes).map((c) => fila(c, diaDelMes(c.fechaInicio!)))}
          </ul>
        </section>
      ))}
      {sinFecha.length > 0 && (
        <section>
          <h2 className="m-0 mb-2.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">
            Fecha a confirmar
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">{sinFecha.map((c) => fila(c, "—"))}</ul>
        </section>
      )}
    </div>
  );
}
