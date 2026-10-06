import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { InstitucionLogo } from "@/components/docente/instituciones-logo";
import { CursoFoto } from "@/components/docente/curso-foto";
import { claseCoincidencia } from "@/lib/coincidencia";
import { kmLegible } from "@/lib/geo";
import type { pendientesDePerfil } from "@/lib/perfil";
import type {
  FilaPostulacion,
  TarjetaCursoDestacado,
  TarjetaInstitucionDestacada,
  TarjetaOferta,
} from "@/lib/queries/docente";
import { cn } from "@/lib/utils";

const CUADRICULA =
  "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-4 max-[560px]:grid-cols-1";

const TARJETA_ENLACE =
  "group flex flex-col rounded-[10px] border border-borde bg-white transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(31,36,33,.1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30";

/** Título de sección del tablero con su "Ver todas" a la derecha y una bajada. */
export function SeccionTablero({
  titulo,
  bajada,
  enlace,
  children,
  className,
}: {
  titulo: string;
  bajada: string;
  enlace?: { href: string; texto: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-[26px]", className)}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5">
        <h2 className="m-0 text-[17px] leading-[1.2] font-semibold">{titulo}</h2>
        {enlace && (
          <Link href={enlace.href} className="text-[13px] leading-none font-medium text-rosa hover:underline">
            {enlace.texto}
          </Link>
        )}
      </div>
      <p className="mb-3.5 text-[13px] leading-normal text-apagado">{bajada}</p>
      {children}
    </section>
  );
}

export function CuadriculaTarjetas({ children }: { children: React.ReactNode }) {
  return <div className={CUADRICULA}>{children}</div>;
}

export function TarjetaOfertaRecomendada({ o }: { o: TarjetaOferta }) {
  const lugar = [o.zona, kmLegible(o.km)].filter(Boolean).join(" · ");
  return (
    <Link href={`/docente/oferta/${o.id}`} className={cn(TARJETA_ENLACE, "p-4")}>
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <InstitucionLogo nombre={o.institucion} logoUrl={o.logoUrl} />
        <span
          className={cn(
            "inline-flex flex-none items-center gap-[5px] rounded-full px-2.5 py-[5px] text-xs leading-none font-bold",
            claseCoincidencia(o.porcentaje),
          )}
        >
          {o.porcentaje}% match
        </span>
      </div>
      <div className="mb-0.5 text-[14.5px] leading-[1.3] font-semibold text-tinta">{o.puesto}</div>
      <div className="mb-2.5 text-[12.5px] leading-[1.35] text-apagado">{o.institucion}</div>
      <div className="mb-3 flex flex-wrap gap-[5px]">
        {o.motivos.map((m) => (
          <Insignia key={m} className="text-[11px]">
            {m}
          </Insignia>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#F0EFEA] pt-3">
        <span className="text-xs leading-[1.3] text-sutil">{lugar || "Zona a confirmar"}</span>
        <span className="flex-none text-[13px] leading-none font-semibold text-rosa">Ver oferta ›</span>
      </div>
    </Link>
  );
}

export function TarjetaInstitucionDestacada({ i }: { i: TarjetaInstitucionDestacada }) {
  return (
    <Link href={`/docente/instituciones/${i.slug}`} className={cn(TARJETA_ENLACE, "p-4")}>
      <div className="mb-2.5 flex gap-[11px]">
        <InstitucionLogo nombre={i.nombre} logoUrl={i.logoUrl} tamano={38} />
        <div className="min-w-0">
          <div className="text-[14.5px] leading-[1.3] font-semibold text-tinta">{i.nombre}</div>
          <div className="text-xs leading-[1.35] text-apagado">{[i.tipo, i.zona].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      {i.resumen && <div className="mb-3 text-[12.5px] leading-normal text-apagado">{i.resumen}</div>}
      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#F0EFEA] pt-3">
        <Insignia tono="verde" className="text-[11px]">
          {i.busquedasActivas === 1 ? "1 búsqueda abierta" : `${i.busquedasActivas} búsquedas abiertas`}
        </Insignia>
        <span className="flex-none text-[13px] leading-none font-semibold text-rosa">Ver perfil ›</span>
      </div>
    </Link>
  );
}

export function TarjetaCursoDestacado({ c }: { c: TarjetaCursoDestacado }) {
  return (
    <Link href={`/docente/cursos?curso=${c.id}`} className={cn(TARJETA_ENLACE, "overflow-hidden")}>
      <div className="relative">
        <CursoFoto url={c.fotoUrl} altura={116} />
        <Insignia tono={c.modalidad === "Online" ? "azul" : "neutro"} className="absolute top-[9px] left-[9px]">
          {c.modalidad}
        </Insignia>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-0.5 text-[14.5px] leading-[1.3] font-semibold text-tinta">{c.titulo}</div>
        {c.subtitulo && <div className="mb-2.5 text-xs leading-[1.35] text-apagado">{c.subtitulo}</div>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 text-xs leading-[1.3] text-sutil">
          <span>{c.fechas}</span>
          <span className="text-[13px] leading-none font-semibold text-rosa">Ver ›</span>
        </div>
      </div>
    </Link>
  );
}

/** "Tus postulaciones": las últimas tres, con el estado como lo ve el docente. */
export function ResumenPostulaciones({ filas }: { filas: FilaPostulacion[] }) {
  return (
    <section className="mt-[26px] rounded-lg border border-borde bg-white p-5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <h2 className="m-0 text-base leading-[1.2] font-semibold">Tus postulaciones</h2>
        <Link href="/docente/postulaciones" className="text-[13px] leading-none font-medium text-rosa hover:underline">
          Ver todas
        </Link>
      </div>
      <ul className="m-0 list-none p-0">
        {filas.map((f) => (
          <li key={f.id} className="flex items-center gap-3.5 border-b border-borde py-3.5 last:border-b-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-[1.3] font-semibold">{f.puesto}</div>
              <div className="mt-0.5 text-[12.5px] leading-[1.4] text-apagado">
                {f.institucion} · postulada el {f.creadaEl}
              </div>
            </div>
            <Insignia tono={f.estado.tono}>{f.estado.texto}</Insignia>
            <Link
              href={`/docente/postulaciones?abrir=${f.id}`}
              className="text-[13px] leading-none font-medium whitespace-nowrap text-rosa hover:underline"
            >
              Ver
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function minuscula(t: string) {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** La tarjeta rosa "Completá tu perfil" con el porcentaje y lo que falta de verdad. */
export function TarjetaCompletaPerfil({ perfil }: { perfil: ReturnType<typeof pendientesDePerfil> }) {
  const { pendientes, porcentaje } = perfil;
  if (pendientes.length === 0) return null;

  const faltan = pendientes.map((p) => minuscula(p.etiqueta));
  const texto =
    faltan.length === 1
      ? `Te falta ${faltan[0]}.`
      : faltan.length === 2
        ? `Te faltan dos cosas: ${faltan[0]} y ${faltan[1]}.`
        : `Te faltan ${faltan.length} cosas: ${faltan[0]}, ${faltan[1]} y ${faltan.length - 2 === 1 ? "1 más" : `${faltan.length - 2} más`}.`;
  const sinFoto = pendientes.some((p) => p.clave === "foto");

  return (
    <div className="mt-4 mb-[26px] flex flex-wrap items-center gap-[22px] rounded-[10px] bg-rosa-tint px-[22px] py-[18px]">
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="mb-2 flex justify-between">
          <span className="text-sm leading-none font-semibold text-rosa">Completá tu perfil</span>
          <span className="text-[13px] leading-none font-semibold text-rosa">{porcentaje}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Perfil completo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
          className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-rosa/15"
        >
          <div className="h-1.5 bg-rosa" style={{ width: `${porcentaje}%` }} />
        </div>
        <div className="text-[13px] leading-normal text-rosa">
          {texto}
          {sinFoto && " Los perfiles con foto reciben el doble de invitaciones."}
        </div>
      </div>
      <BotonLink href="/docente/perfil" className="flex-none bg-rosa hover:bg-[#7A0F4D]">
        Completar perfil
      </BotonLink>
    </div>
  );
}
