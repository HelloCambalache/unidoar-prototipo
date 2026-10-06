import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { etiquetaFechas } from "@/lib/fechas-curso";
import type { CursoHistorial, CursoVista, resumenFormacion } from "@/lib/queries/cursos";

type Resumen = ReturnType<typeof resumenFormacion>;

function Cifra({ etiqueta, valor, color, separada }: { etiqueta: string; valor: number; color: string; separada?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${separada ? "border-t border-[#F0EFEA] pt-3" : ""}`}>
      <span className="text-[13.5px] leading-none text-tinta-2">{etiqueta}</span>
      <span className={`text-lg leading-none font-semibold ${color}`}>{valor}</span>
    </div>
  );
}

function TarjetaFormacion({ resumen, variante }: { resumen: Resumen; variante: "lista" | "historial" }) {
  return (
    <section className="rounded-[10px] border border-borde bg-white p-5">
      <EtiquetaSeccion className="mb-3.5">Tu formación</EtiquetaSeccion>
      <div className="flex flex-col gap-3">
        <Cifra etiqueta="Cursos completados" valor={resumen.completados} color="text-verde" />
        {variante === "historial" ? (
          <Cifra etiqueta="Certificados" valor={resumen.certificados} color="text-rosa" />
        ) : (
          <Cifra etiqueta="Inscripto/a ahora" valor={resumen.anotadoAhora} color="text-rosa" />
        )}
        <Cifra etiqueta="Puntaje acumulado" valor={resumen.puntaje} color="text-[#7A5900]" separada />
      </div>
    </section>
  );
}

function TarjetaSumanEnPerfil() {
  return (
    <section className="rounded-[10px] border border-borde bg-white p-[18px]">
      <div className="mb-1.5 text-[13px] leading-[1.3] font-semibold">Los cursos suman en tu perfil</div>
      <p className="m-0 mb-3 text-[13px] leading-normal text-apagado">
        Las instituciones ven tus certificaciones cuando revisan tu perfil.
      </p>
      <BotonLink href="/docente/perfil" variante="secundario" bloque>
        Ver mi perfil
      </BotonLink>
    </section>
  );
}

/** Columna derecha de la pantalla de cursos. En "Lista"/"Agenda" muestra el curso destacado; en "Mis cursos", el que está cursando. */
export function CursoLateral({
  variante,
  resumen,
  destacado,
  enCurso,
}: {
  variante: "lista" | "historial";
  resumen: Resumen;
  /** El curso con más gente anotada entre los que se pueden tomar. */
  destacado?: CursoVista | null;
  enCurso?: CursoHistorial | null;
}) {
  return (
    <aside className="flex w-[280px] flex-none flex-col gap-4 max-[1000px]:w-full">
      <TarjetaFormacion resumen={resumen} variante={variante} />
      {variante === "lista" && destacado && (
        <Link
          href={`/docente/cursos?curso=${destacado.id}`}
          className="block rounded-[10px] bg-rosa-tint p-[18px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30"
        >
          <div className="mb-2.5 text-[11px] leading-none font-semibold tracking-[.06em] text-rosa uppercase">Curso destacado</div>
          <div className="mb-1 text-[15px] leading-[1.3] font-semibold text-rosa">{destacado.titulo}</div>
          <div className="mb-3 text-[12.5px] leading-[1.45] text-rosa">
            {[destacado.subtitulo, etiquetaFechas(destacado.fechaInicio, destacado.fechaFinal)].filter(Boolean).join(" · ")}
          </div>
          <span className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-rosa text-sm font-semibold text-white">
            Ver el curso
          </span>
        </Link>
      )}
      {variante === "historial" && enCurso && (
        <section className="rounded-[10px] bg-rosa-tint p-[18px]">
          <div className="mb-2.5 text-[11px] leading-none font-semibold tracking-[.06em] text-rosa uppercase">Seguí donde dejaste</div>
          <div className="mb-1 text-[15px] leading-[1.3] font-semibold text-rosa">{enCurso.titulo}</div>
          <div className="mb-3 text-[12.5px] leading-[1.4] text-rosa">
            {enCurso.institucion.nombre} · {etiquetaFechas(enCurso.fechaInicio, enCurso.fechaFinal)}
          </div>
          <div
            role="progressbar"
            aria-label={`Avance de ${enCurso.titulo}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={enCurso.avance}
            className="mb-3.5 h-1.5 overflow-hidden rounded-full bg-rosa/[.18]"
          >
            <div className="h-1.5 bg-rosa" style={{ width: `${enCurso.avance}%` }} />
          </div>
          <BotonLink href={`/docente/cursos?curso=${enCurso.id}`} bloque className="bg-rosa hover:bg-[#7A0F4D]">
            {enCurso.link ? "Continuar curso" : "Ver curso"}
          </BotonLink>
        </section>
      )}
      <TarjetaSumanEnPerfil />
    </aside>
  );
}
