"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { actualizarVitrinaComoAdmin } from "@/app/actions/backoffice-instituciones";
import { actualizarVitrina } from "@/app/actions/institucion";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { VitrinaGaleria, type FotoEditable } from "@/components/institucion/vitrina-galeria";
import { VitrinaNovedades, type NovedadEditable } from "@/components/institucion/vitrina-novedades";
import { VitrinaValores } from "@/components/institucion/vitrina-valores";
import { LogoInstitucion } from "@/components/publico/logo-institucion";
import { Boton, BotonLink, botonClases } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/insignia";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { ROLES_CONTACTO, TIPOS_INSTITUCION } from "@/lib/catalogo";
import { focoDeFoto } from "@/lib/fotos";
import type { BusquedaAbierta, CursoVitrina, DatosFormularioVitrina, VitrinaFotoVista, VitrinaNovedadVista } from "@/lib/vitrina";
import { cn } from "@/lib/utils";

export type { DatosFormularioVitrina } from "@/lib/vitrina";

/** Campo "de lectura que se edita": sin borde hasta que se pasa el mouse o se enfoca (como el prototipo). */
const EN_LINEA =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-tinta transition-colors placeholder:text-sutil hover:border-borde focus:border-navy-700 focus:bg-white focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none aria-invalid:border-[#dc2626]";
const SIN_FLECHAS = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const TITULO_CARD = "text-base leading-none font-semibold";

const aEditable = {
  fotos: (fotos: VitrinaFotoVista[]): FotoEditable[] => fotos.map((f) => ({ ...f, clave: f.id })),
  novedades: (novedades: VitrinaNovedadVista[]): NovedadEditable[] => novedades.map((n) => ({ ...n, clave: n.id })),
};

function MensajeError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
      {children}
    </p>
  );
}

/**
 * Pantalla "Perfil público" (la vitrina): todo se edita en el lugar y un solo "Guardar cambios" lo publica.
 * Los campos viven en el estado del formulario; la acción recibe el conjunto completo (datos, valores, galería y
 * novedades), lo valida y lo guarda en una transacción. Cursos y búsquedas abiertas son de solo lectura.
 *
 * Con `institucionIdAdmin` lo usa el equipo de UNIDOAR desde el backoffice para editar el perfil de otra institución: guarda
 * por `actualizarVitrinaComoAdmin` y los textos y enlaces dejan de hablarle a la institución (no hay un área de institución
 * a la que mandar).
 */
export function VitrinaFormulario({
  slug,
  verificada,
  inicial,
  fotos,
  novedades,
  cursos,
  busquedasAbiertas,
  almacenamientoDisponible,
  institucionIdAdmin,
  huella,
}: {
  slug: string;
  verificada: boolean;
  inicial: DatosFormularioVitrina;
  /** Huella de lo guardado cuando se abrió la pantalla (`huellaDeVitrina`): el servidor no pisa lo que otra persona cambió mientras tanto. */
  huella: string;
  fotos: VitrinaFotoVista[];
  novedades: VitrinaNovedadVista[];
  cursos: CursoVitrina[];
  busquedasAbiertas: BusquedaAbierta[];
  almacenamientoDisponible: boolean;
  /** Solo desde el backoffice: el id de la institución que se edita. */
  institucionIdAdmin?: string;
}) {
  const admin = Boolean(institucionIdAdmin);
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [d, setD] = useState(inicial);
  // Contra qué se compara el próximo guardado: lo que se abrió, y después lo que quedó guardado con el último "Guardar cambios".
  const [huellaBase, setHuellaBase] = useState(huella);
  const [fotosEd, setFotosEd] = useState(() => aEditable.fotos(fotos));
  const [novedadesEd, setNovedadesEd] = useState(() => aEditable.novedades(novedades));
  const [errores, setErrores] = useState<Record<string, string>>({});
  // Quitar una imagen reinicia su botón de subida (si no, seguiría mostrando el "✓" de la subida anterior).
  const [reinicios, setReinicios] = useState({ portada: 0, logo: 0 });

  const set = <K extends keyof DatosFormularioVitrina>(clave: K, valor: DatosFormularioVitrina[K]) => {
    setD((p) => ({ ...p, [clave]: valor }));
    setErrores((e) => {
      if (!(clave in e)) return e;
      const resto = { ...e };
      delete resto[clave];
      return resto;
    });
  };

  // Los vocabularios cerrados incluyen lo que la cuenta ya tenía guardado, aunque no esté en la lista.
  const tipos: string[] = [...TIPOS_INSTITUCION];
  if (d.tipo && !tipos.includes(d.tipo)) tipos.push(d.tipo);
  const rolesContacto: string[] = [...ROLES_CONTACTO];
  if (d.contactoRol && !rolesContacto.includes(d.contactoRol)) rolesContacto.push(d.contactoRol);

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrores({});
    empezar(async () => {
      try {
        const carga = {
          ...d,
          huella: huellaBase,
          fotos: fotosEd.map((f) => ({ ...(f.id ? { id: f.id } : {}), url: f.url, etiqueta: f.etiqueta })),
          novedades: novedadesEd.map((n) => ({
            ...(n.id ? { id: n.id } : {}),
            titulo: n.titulo,
            texto: n.texto,
            fecha: n.fecha,
          })),
        };
        const r = institucionIdAdmin ? await actualizarVitrinaComoAdmin(institucionIdAdmin, carga) : await actualizarVitrina(carga);
        if (r.ok) {
          // Las listas vuelven con sus ids: así el próximo guardado actualiza en vez de duplicar.
          setFotosEd(aEditable.fotos(r.data.fotos));
          setNovedadesEd(aEditable.novedades(r.data.novedades));
          setHuellaBase(r.data.huella);
          toast(admin ? "Cambios guardados: ya se ven en la vitrina pública de la institución." : "Cambios guardados: ya se ven en tu vitrina pública.");
        } else {
          setErrores(r.campos ?? {});
          toast(r.error, "error");
        }
      } catch {
        toast("No pudimos guardar los cambios. Probá de nuevo.", "error");
      }
    });
  };

  const cantidadErrores = Object.keys(errores).length;

  return (
    <form onSubmit={guardar} noValidate>
      <EncabezadoPagina
        titulo="Perfil público"
        bajada={
          admin
            ? "Así ven los profesionales a esta institución. Estás editando como equipo de UNIDOAR: los cambios se publican en su vitrina y quedan registrados."
            : "Así te ven los profesionales cuando entran a tu vitrina. Tocá cualquier campo para editarlo."
        }
        acciones={
          <a
            href={`/instituciones/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(botonClases({ variante: "secundario", tamano: "lg" }), "gap-[7px] text-sm text-tinta hover:text-tinta")}
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M14 4h6v6" />
              <path d="M20 4l-9 9" />
              <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
            </svg>
            Ver perfil público
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        }
      />

      {/* Portada, logo e identidad */}
      <Tarjeta className="mb-4 overflow-hidden p-0">
        {/* Misma proporción que en la vitrina pública: lo que se ve acá es lo que van a ver los profesionales. */}
        <div className="relative aspect-[16/7] w-full bg-[linear-gradient(135deg,#16214F,#2A3A7A)]">
          {d.portadaUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- portada subida por la institución, tamaño libre
            <img
              src={d.portadaUrl}
              alt="Foto de portada"
              style={{ objectPosition: focoDeFoto(d.portadaUrl) }}
              className="block size-full object-cover"
            />
          )}
          <div className="absolute top-3 right-3 flex items-start gap-2">
            {d.portadaUrl && (
              <Boton
                tamano="sm"
                variante="secundario"
                onClick={() => {
                  set("portadaUrl", "");
                  setReinicios((r) => ({ ...r, portada: r.portada + 1 }));
                }}
              >
                Quitar
              </Boton>
            )}
            <SubirArchivo
              key={`portada-${reinicios.portada}`}
              bucket="publico"
              carpeta="portadas"
              nombre="portadaUrl"
              etiqueta="foto de portada"
              textoBoton={d.portadaUrl ? "Cambiar portada" : "Subir portada"}
              variante="boton"
              disponible={almacenamientoDisponible}
              onCambio={(v) => v && set("portadaUrl", v)}
            />
          </div>
          {errores.portadaUrl && (
            <p role="alert" className="absolute bottom-2 left-3 m-0 rounded bg-white px-2 py-1 text-xs text-[#b91c1c]">
              {errores.portadaUrl}
            </p>
          )}
        </div>

        <div className="px-6 pb-[22px] max-[560px]:px-4">
          {/* relative z-[2]: la portada es `relative` y se pintaría encima del logo, que sube sobre ella con el margen negativo. */}
          <div className="relative z-[2] -mt-8 flex gap-[18px] max-[560px]:flex-wrap max-[560px]:gap-3">
            <div className="flex flex-none flex-col items-start gap-2">
              <LogoInstitucion
                nombre={d.nombre || "Institución"}
                logoUrl={d.logoUrl || null}
                tamano={88}
                className="rounded-xl border-4 border-white bg-white shadow-[0_2px_6px_rgba(0,0,0,.15)]"
              />
              <div className="flex items-center gap-2">
                <SubirArchivo
                  key={`logo-${reinicios.logo}`}
                  bucket="publico"
                  carpeta="logos"
                  nombre="logoUrl"
                  etiqueta="logo"
                  textoBoton={d.logoUrl ? "Cambiar logo" : "Subir logo"}
                  variante="boton"
                  disponible={almacenamientoDisponible}
                  onCambio={(v) => v && set("logoUrl", v)}
                />
                {d.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      set("logoUrl", "");
                      setReinicios((r) => ({ ...r, logo: r.logo + 1 }));
                    }}
                    className="rounded text-xs font-medium text-sutil hover:text-tinta hover:underline focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <MensajeError>{errores.logoUrl}</MensajeError>
            </div>

            <div className="min-w-0 flex-1 pt-[38px] max-[560px]:basis-full max-[560px]:pt-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  aria-label="Nombre de la institución"
                  aria-invalid={Boolean(errores.nombre)}
                  value={d.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  maxLength={120}
                  className={cn(EN_LINEA, "min-w-[200px] flex-1 text-[22px] leading-[1.2] font-semibold max-[860px]:text-lg")}
                />
                {verificada && (
                  <Insignia tono="verde" className="flex-none">
                    Institución verificada
                  </Insignia>
                )}
              </div>
              <MensajeError>{errores.nombre}</MensajeError>
              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                <div className="min-w-[160px] flex-1">
                  <Select
                    aria-label="Tipo de institución"
                    aria-invalid={Boolean(errores.tipo)}
                    value={d.tipo}
                    onChange={(e) => set("tipo", e.target.value)}
                    className="rounded-md border-transparent bg-transparent px-1.5 py-0.5 pr-8 text-[13px] text-apagado hover:border-borde"
                  >
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <MensajeError>{errores.tipo}</MensajeError>
                </div>
                <div className="flex min-w-[160px] flex-1 flex-col">
                  <label className="flex items-center gap-1 text-[13px] text-apagado">
                    <span className="flex-none pl-1.5">Fundado en</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-invalid={Boolean(errores.fundada)}
                      value={d.fundada}
                      onChange={(e) => set("fundada", e.target.value)}
                      placeholder="año"
                      className={cn(EN_LINEA, SIN_FLECHAS, "w-[84px] text-[13px] text-apagado")}
                    />
                  </label>
                  <MensajeError>{errores.fundada}</MensajeError>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tarjeta>

      <div className="flex items-start gap-6 max-[1000px]:flex-wrap max-[860px]:flex-col max-[860px]:gap-4">
        <div className="min-w-0 flex-1 max-[860px]:w-full">
          {/* Métricas */}
          <div className="mb-4 grid grid-cols-4 gap-px overflow-hidden rounded-ud border border-borde bg-borde max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
            <div className="bg-white px-[18px] py-4">
              <input
                type="number"
                inputMode="numeric"
                aria-label="Cantidad de alumnos"
                aria-invalid={Boolean(errores.alumnos)}
                value={d.alumnos}
                onChange={(e) => set("alumnos", e.target.value)}
                placeholder="—"
                className={cn(EN_LINEA, SIN_FLECHAS, "w-[90px] text-xl leading-none font-semibold")}
              />
              <div className="mt-1 pl-1.5 text-xs leading-[1.3] text-apagado">alumnos</div>
              <MensajeError>{errores.alumnos}</MensajeError>
            </div>
            <div className="bg-white px-[18px] py-4">
              <input
                aria-label="Niveles que dicta"
                aria-invalid={Boolean(errores.niveles)}
                value={d.niveles}
                onChange={(e) => set("niveles", e.target.value)}
                placeholder="Inicial · Primario"
                maxLength={160}
                className={cn(EN_LINEA, "text-sm leading-[1.3] font-semibold")}
              />
              <div className="mt-1 pl-1.5 text-xs leading-[1.3] text-apagado">niveles que dicta</div>
              <MensajeError>{errores.niveles}</MensajeError>
            </div>
            <div className="bg-white px-[18px] py-4">
              <input
                aria-label="Turnos"
                aria-invalid={Boolean(errores.turnos)}
                value={d.turnos}
                onChange={(e) => set("turnos", e.target.value)}
                placeholder="Mañana y tarde"
                maxLength={120}
                className={cn(EN_LINEA, "text-sm leading-[1.3] font-semibold")}
              />
              <div className="mt-1 pl-1.5 text-xs leading-[1.3] text-apagado">turnos</div>
              <MensajeError>{errores.turnos}</MensajeError>
            </div>
            <div className="bg-white px-[18px] py-4">
              <input
                type="number"
                inputMode="numeric"
                aria-label="Profesionales en planta"
                aria-invalid={Boolean(errores.docentesPlanta)}
                value={d.docentesPlanta}
                onChange={(e) => set("docentesPlanta", e.target.value)}
                placeholder="—"
                className={cn(EN_LINEA, SIN_FLECHAS, "w-[90px] text-xl leading-none font-semibold")}
              />
              <div className="mt-1 pl-1.5 text-xs leading-[1.3] text-apagado">profesionales en planta</div>
              <MensajeError>{errores.docentesPlanta}</MensajeError>
            </div>
          </div>

          {/* Sobre nosotros */}
          <Tarjeta como="section" className="mb-4 p-[22px]">
            <h2 className={cn(TITULO_CARD, "m-0 mb-3")}>Sobre nosotros</h2>
            <Textarea
              aria-label="Sobre nosotros"
              aria-invalid={Boolean(errores.descripcion)}
              value={d.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              maxLength={2000}
              placeholder="Contá quiénes son, cómo trabajan y qué buscan en un profesional."
              className="min-h-[100px] text-sm leading-[1.6]"
            />
            <MensajeError>{errores.descripcion}</MensajeError>

            <div className="mt-4 grid grid-cols-2 gap-3.5 max-[700px]:grid-cols-1">
              <Campo etiqueta="Nombre de contacto" error={errores.contactoNombre}>
                <Input
                  value={d.contactoNombre}
                  onChange={(e) => set("contactoNombre", e.target.value)}
                  maxLength={120}
                  aria-invalid={Boolean(errores.contactoNombre)}
                />
              </Campo>
              <Campo etiqueta="Rol en la institución" error={errores.contactoRol}>
                <Select value={d.contactoRol} onChange={(e) => set("contactoRol", e.target.value)} aria-invalid={Boolean(errores.contactoRol)}>
                  {!d.contactoRol && <option value="">Elegí un rol</option>}
                  {rolesContacto.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>
            <div className="mt-3.5 flex flex-col gap-3.5">
              <Campo etiqueta="Misión" error={errores.mision}>
                <Textarea
                  value={d.mision}
                  onChange={(e) => set("mision", e.target.value)}
                  maxLength={600}
                  placeholder="¿Cuál es el propósito de tu institución?"
                  aria-invalid={Boolean(errores.mision)}
                />
              </Campo>
              <Campo etiqueta="Visión" error={errores.vision}>
                <Textarea
                  value={d.vision}
                  onChange={(e) => set("vision", e.target.value)}
                  maxLength={600}
                  placeholder="¿A dónde quiere llegar tu institución?"
                  aria-invalid={Boolean(errores.vision)}
                />
              </Campo>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-apagado">Valores</span>
                <VitrinaValores valores={d.valores} onCambiar={(v) => set("valores", v)} error={errores.valores} />
              </div>
            </div>
          </Tarjeta>

          {/* Cursos: solo lectura, se administran en su propia pantalla */}
          <Tarjeta como="section" className="mb-4 p-[22px]">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <h2 className={cn(TITULO_CARD, "m-0")}>{admin ? "Cursos que dicta la institución" : "Cursos que dicta tu institución"}</h2>
              {!admin && (
                <Link href="/institucion/cursos" className="text-[13px] leading-none font-medium text-navy-700 hover:underline">
                  Administrar cursos
                </Link>
              )}
            </div>
            <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">
              {admin
                ? "Los cursos los administra la propia institución. Los profesionales los ven cuando entran a su vitrina."
                : "Cursos cortos o certificaciones que ofrecés. Los profesionales los ven cuando entran a tu vitrina."}
            </p>
            {cursos.length === 0 ? (
              <div className="rounded-[10px] border-[1.5px] border-dashed border-borde-fuerte px-5 py-6 text-center">
                <p className="m-0 mb-3 text-[13.5px] leading-normal text-apagado">{admin ? "Todavía no cargó cursos." : "Todavía no cargaste cursos."}</p>
                {!admin && (
                  <BotonLink href="/institucion/cursos/nuevo" variante="secundario" tamano="sm">
                    Crear un curso
                  </BotonLink>
                )}
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                {cursos.map((c) => (
                  <li key={c.id} className="flex gap-3.5 rounded-lg border border-borde p-3.5 max-[860px]:flex-wrap">
                    {c.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto del curso, origen y tamaño libres
                      <img
                        src={c.fotoUrl}
                        alt=""
                        style={{ objectPosition: focoDeFoto(c.fotoUrl) }}
                        className="h-[90px] w-[120px] flex-none rounded-lg object-cover max-[860px]:h-[180px] max-[860px]:w-full"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1 max-[860px]:basis-full">
                      <div className="text-sm leading-[1.3] font-semibold">{c.titulo}</div>
                      {c.subtitulo && <div className="mt-0.5 text-xs leading-[1.3] font-medium text-navy-700">{c.subtitulo}</div>}
                      {c.descripcion && (
                        <p className="m-0 mt-1 line-clamp-3 text-[13px] leading-normal text-apagado">{c.descripcion}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta como="section" className="mb-4 p-[22px]">
            <VitrinaGaleria fotos={fotosEd} onCambiar={setFotosEd} errores={errores} disponible={almacenamientoDisponible} />
          </Tarjeta>

          <Tarjeta como="section" className="p-[22px]">
            <VitrinaNovedades novedades={novedadesEd} onCambiar={setNovedadesEd} errores={errores} />
          </Tarjeta>
        </div>

        <aside className="flex w-[280px] flex-none flex-col gap-4 max-[1000px]:w-full">
          <Tarjeta como="section" className="p-[18px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="m-0 text-sm leading-none font-semibold">Búsquedas abiertas</h2>
              <Insignia tono="azul">{busquedasAbiertas.length}</Insignia>
            </div>
            {busquedasAbiertas.length === 0 ? (
              <p className="m-0 text-[13px] leading-normal text-apagado">
                {admin ? (
                  "No tiene búsquedas abiertas."
                ) : (
                  <>
                    No tenés búsquedas abiertas.{" "}
                    <Link href="/institucion/publicar" className="font-semibold text-navy-700 hover:underline">
                      Publicá una
                    </Link>
                    .
                  </>
                )}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {busquedasAbiertas.map((b) => (
                  <li key={b.id} className="border-b border-borde pb-2.5 last:border-b-0 last:pb-0">
                    {admin ? (
                      <div className="text-tinta">
                        <div className="text-[13px] leading-[1.3] font-semibold">{b.puesto}</div>
                        <div className="mt-0.5 text-xs leading-[1.3] text-apagado">
                          {b.postulantes === 1 ? "1 postulante" : `${b.postulantes} postulantes`}
                        </div>
                      </div>
                    ) : (
                      <Link href={`/institucion/postulantes?busqueda=${b.id}`} className="block text-tinta hover:text-navy-700">
                        <div className="text-[13px] leading-[1.3] font-semibold">{b.puesto}</div>
                        <div className="mt-0.5 text-xs leading-[1.3] text-apagado">
                          {b.postulantes === 1 ? "1 postulante" : `${b.postulantes} postulantes`}
                        </div>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta como="section" className="p-[18px]">
            <h2 className="m-0 mb-3 text-sm leading-none font-semibold">Datos de contacto</h2>
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-[13px] leading-[1.45] text-apagado">
                La dirección y la zona están en <a href="#sedes">Sedes</a>, al final de la página.
              </p>
              <Campo etiqueta="Horario de administración" error={errores.horarioAdministracion}>
                <Input
                  value={d.horarioAdministracion}
                  onChange={(e) => set("horarioAdministracion", e.target.value)}
                  maxLength={120}
                  placeholder="Ej. 8 a 16 hs"
                  aria-invalid={Boolean(errores.horarioAdministracion)}
                />
              </Campo>
            </div>
          </Tarjeta>
        </aside>
      </div>

      <div className="mt-[22px] flex items-center justify-end gap-3.5 border-t border-borde pt-[18px] max-[860px]:flex-col max-[860px]:items-stretch">
        <span className="text-[13px] leading-[1.4] text-apagado max-[860px]:text-center">
          {cantidadErrores > 0 ? (
            <span role="alert" className="text-[#b91c1c]">
              Revisá los campos marcados antes de guardar.
            </span>
          ) : (
            admin ? "Los cambios se publican en la vitrina pública de la institución." : "Los cambios se publican en tu vitrina pública."
          )}
        </span>
        <Boton type="submit" variante="cta" tamano="lg" disabled={pendiente} aria-busy={pendiente} className="min-w-[200px] max-[860px]:min-w-0">
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </Boton>
      </div>
    </form>
  );
}
