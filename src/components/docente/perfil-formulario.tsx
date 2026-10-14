"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { actualizarPerfilDocente } from "@/app/actions/docente";
import { Boton, BotonLink } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/insignia";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { Icono } from "@/components/icons";
import { PerfilDisponibilidad } from "@/components/docente/perfil-disponibilidad";
import { PerfilEtiquetas } from "@/components/docente/perfil-etiquetas";
import type { DocumentacionPerfil, EstadoDocumento } from "@/components/docente/perfil-server";
import type { Resultado } from "@/lib/acciones";
import { NIVELES } from "@/lib/catalogo";
import { CONSTANCIA } from "@/lib/estudiantes";
import type { DatosPerfil } from "@/lib/perfil-docente";
import { cn } from "@/lib/utils";

type TonoInsignia = "neutro" | "azul" | "verde" | "rosa" | "naranja" | "ambar";

const RADIOS = [5, 10, 15, 20, 30, 50, 100];

/** Campo "de lectura que se edita": sin borde hasta que se pasa el mouse o se enfoca (como el prototipo). */
const EN_LINEA =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-tinta transition-colors placeholder:text-sutil hover:border-borde focus:border-navy-700 focus:bg-white focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none";

const TITULO_SECCION = "m-0 text-[15px] leading-none font-semibold";
const ACCION_TEXTO =
  "cursor-pointer rounded text-[13px] leading-none font-medium text-navy-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

type Props = {
  inicial: DatosPerfil;
  /** Identidad (DNI) verificada: el nombre y el apellido se muestran fijos, sin poder editarlos. */
  identidadFija: boolean;
  insignia: { texto: string; tono: TonoInsignia };
  emailCuenta: string;
  sugerencias: { zonas: string[]; asignaturas: string[] };
  /** URL firmada para ver el CV subido, si hay uno. */
  cvEnlace: string | null;
  conductaEstado: EstadoDocumento;
  /** DNI y título: en qué está cada uno y si se puede cargar o corregir. */
  documentacion: DocumentacionPerfil;
  /** Bloque "Estado de verificación" (servidor). */
  verificacion: ReactNode;
  /** Tarjeta "Cursos hechos en UNIDOAR" (servidor). */
  cursosHechos: ReactNode;
  /** Porcentaje de perfil completo (servidor). */
  lateral: ReactNode;
  /** Tarjeta "Compartir mi perfil" (cliente, independiente del formulario). */
  compartir: ReactNode;
};

const DETALLE_CONDUCTA: Record<EstadoDocumento, string> = {
  verificado: "Ya lo verificamos: las instituciones lo ven en tu perfil.",
  revision: "Lo recibimos y lo estamos revisando.",
  sin: "Es optativo. Sumarlo da más confianza a las instituciones que lo piden.",
};

/** Una fila de documentación: ícono según el estado, qué es, en qué está y los botones para cargarlo. */
function FilaDocumento({
  id,
  estado,
  titulo,
  optativo,
  detalle,
  error,
  children,
}: {
  id?: string;
  estado: EstadoDocumento;
  titulo: string;
  optativo?: boolean;
  detalle: string;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <div id={id} className="mt-3.5 flex scroll-mt-24 flex-wrap items-center gap-3.5 rounded-lg border border-borde bg-white px-[18px] py-4">
      <span
        aria-hidden
        className={cn(
          "inline-flex size-[34px] flex-none items-center justify-center rounded-lg",
          estado === "verificado" ? "bg-verde-tint text-verde" : "bg-[#F0EFEA] text-apagado",
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9.5 14.5l1.8 1.8 3.2-3.6" />
        </svg>
      </span>
      <div className="min-w-[220px] flex-1">
        <div className="mb-[3px] flex items-center gap-1.5 text-sm leading-[1.3] font-semibold">
          {titulo} {optativo && <Insignia className="text-apagado">Optativo</Insignia>}
        </div>
        <div className="text-[13px] leading-[1.45] text-apagado">{detalle}</div>
        {error && (
          <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
            {error}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Formulario completo de "Mi perfil". Todo el estado vive acá y se manda como JSON en un campo
 * oculto; la acción lo valida con Zod y guarda. Los bloques sin estado llegan ya renderizados.
 */
export function PerfilFormulario({
  inicial,
  identidadFija,
  insignia,
  emailCuenta,
  sugerencias,
  cvEnlace,
  conductaEstado,
  documentacion,
  verificacion,
  cursosHechos,
  lateral,
  compartir,
}: Props) {
  const toast = useToast();
  const [d, setD] = useState<DatosPerfil>(inicial);
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(actualizarPerfilDocente, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast("Perfil guardado");
    else toast(estado.error, "error");
  }, [estado, toast]);

  const set = <K extends keyof DatosPerfil>(clave: K, valor: DatosPerfil[K]) => setD((p) => ({ ...p, [clave]: valor }));
  const estudiando = d.situacionEstudio === "estudiante";
  const error = (clave: string) => (estado && !estado.ok ? estado.campos?.[clave] : undefined);

  const radios = RADIOS.includes(d.radioKm) ? RADIOS : [...RADIOS, d.radioKm].sort((a, b) => a - b);
  // Los niveles del vocabulario y, si el docente cargó alguno distinto en el alta, ese también.
  const niveles = [...NIVELES, ...d.niveles.filter((n) => !(NIVELES as readonly string[]).includes(n))];

  const actualizarExperiencia = (i: number, campo: keyof DatosPerfil["experiencia"][number], valor: string) =>
    set(
      "experiencia",
      d.experiencia.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)),
    );
  const actualizarFormacion = (i: number, campo: keyof DatosPerfil["formacion"][number], valor: string) =>
    set(
      "formacion",
      d.formacion.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)),
    );

  return (
    <form action={accion}>
      <input type="hidden" name="datos" value={JSON.stringify(d)} />

      <div className="flex items-start gap-6 max-[1000px]:flex-wrap max-[860px]:flex-col max-[860px]:gap-4">
        <div className="min-w-0 flex-1 max-[860px]:w-full">
          {/* Identidad: foto, nombre, zonas y verificación */}
          <Tarjeta como="section" className="mb-4 p-6">
            <div className="flex gap-[18px] max-[560px]:flex-col">
              <SubirArchivo
                bucket="publico"
                carpeta="fotos"
                nombre="fotoUrl"
                etiqueta="Foto"
                ayuda=""
                variante="circulo"
                valorInicial={inicial.fotoUrl}
                onCambio={(v) => set("fotoUrl", v)}
                className="w-[104px] flex-none"
              />
              <div className="min-w-0 flex-1">
                {identidadFija ? (
                  <>
                    {/* Con el DNI verificado el nombre es el del documento: se muestra fijo y solo lo corrige el equipo. */}
                    <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <h2 className="m-0 text-xl leading-[1.2] font-semibold [overflow-wrap:anywhere]">{`${inicial.nombre} ${inicial.apellido}`.trim()}</h2>
                      <Insignia tono={insignia.tono} className="flex-none">
                        {insignia.texto}
                      </Insignia>
                    </div>
                    <p className="m-0 mb-2 text-xs leading-normal text-apagado">
                      Tu nombre ya está verificado con tu DNI, por eso no se puede cambiar. Si hay un error,{" "}
                      <Link href="/contacto" className="font-medium">
                        escribinos desde Contacto
                      </Link>
                      .
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-2 grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
                      <Campo etiqueta="Nombre" error={error("nombre")}>
                        <Input
                          autoComplete="given-name"
                          maxLength={60}
                          aria-invalid={!!error("nombre")}
                          value={d.nombre}
                          onChange={(e) => set("nombre", e.target.value)}
                        />
                      </Campo>
                      <Campo etiqueta="Apellido" error={error("apellido")}>
                        <Input
                          autoComplete="family-name"
                          maxLength={80}
                          aria-invalid={!!error("apellido")}
                          value={d.apellido}
                          onChange={(e) => set("apellido", e.target.value)}
                        />
                      </Campo>
                    </div>
                    <Insignia tono={insignia.tono} className="mb-2 flex-none">
                      {insignia.texto}
                    </Insignia>
                  </>
                )}
                <input
                  aria-label="Subtítulo de tu perfil"
                  placeholder="Ej. Profesora de Ed. Física · 12 años de experiencia"
                  value={d.subtitulo}
                  onChange={(e) => set("subtitulo", e.target.value)}
                  className={cn(EN_LINEA, "text-sm leading-[1.4] text-apagado")}
                />
                <div className="mt-2.5">
                  <PerfilEtiquetas
                    items={d.zonas}
                    onCambiar={(z) => set("zonas", z)}
                    sugerencias={sugerencias.zonas}
                    soloSugerencias={sugerencias.zonas.length > 0}
                    textoAgregar="agregar zona"
                    etiquetaCampo="Agregar una zona"
                    max={12}
                  />
                  {error("zonas") && (
                    <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
                      {error("zonas")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {verificacion}

            <FilaDocumento
              id="documentacion"
              estado={documentacion.dni.estado}
              titulo="Identidad (DNI)"
              detalle={documentacion.dni.detalle}
              error={error("dniFrente") ?? error("dniDorso")}
            >
              {documentacion.dni.editable && (
                <>
                  <SubirArchivo
                    bucket="privado"
                    carpeta="documentos"
                    nombre="dniFrente"
                    etiqueta="DNI, frente"
                    variante="boton"
                    textoBoton={d.dniFrente ? "Frente cargado" : "Frente"}
                    valorInicial={inicial.dniFrente}
                    onCambio={(v) => set("dniFrente", v)}
                  />
                  <SubirArchivo
                    bucket="privado"
                    carpeta="documentos"
                    nombre="dniDorso"
                    etiqueta="DNI, dorso"
                    variante="boton"
                    textoBoton={d.dniDorso ? "Dorso cargado" : "Dorso"}
                    valorInicial={inicial.dniDorso}
                    onCambio={(v) => set("dniDorso", v)}
                  />
                </>
              )}
            </FilaDocumento>

            {documentacion.estudiosEditables && (
              <div className="mt-3.5 rounded-lg border border-borde bg-white px-[18px] py-4">
                <div className="mb-3 text-sm leading-[1.3] font-semibold">Tus estudios</div>
                <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
                  <Campo etiqueta="Situación" error={error("situacionEstudio")}>
                    <Select
                      value={estudiando ? "estudiante" : "recibido"}
                      onChange={(e) => set("situacionEstudio", e.target.value === "estudiante" ? "estudiante" : "recibido")}
                    >
                      <option value="recibido">Ya me recibí</option>
                      <option value="estudiante">Estoy estudiando</option>
                    </Select>
                  </Campo>
                  {estudiando && (
                    <Campo etiqueta="Materias aprobadas (%)" error={error("porcentajeMaterias")} ayuda="Las instituciones lo ven en tu perfil.">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={d.porcentajeMaterias ?? ""}
                        onChange={(e) => set("porcentajeMaterias", e.target.value)}
                      />
                    </Campo>
                  )}
                </div>
                <p className="m-0 mt-3 text-[13px] leading-[1.45] text-apagado">
                  {estudiando
                    ? "Mientras estudiás no te pedimos el título: alcanza con la constancia de alumno regular. Cuando te recibas, cambiá a «Ya me recibí» y subí el título."
                    : "Si todavía estás cursando, elegí «Estoy estudiando» y subí tu constancia de alumno regular."}
                </p>
              </div>
            )}

            {estudiando && (
              <FilaDocumento
                estado={documentacion.constancia.estado}
                titulo={CONSTANCIA.nombre}
                detalle={documentacion.constancia.detalle}
                error={error("constancia")}
              >
                {documentacion.constancia.editable && (
                  <SubirArchivo
                    bucket="privado"
                    carpeta="documentos"
                    nombre="constancia"
                    etiqueta={CONSTANCIA.nombre}
                    variante="boton"
                    textoBoton={d.constancia ? "Constancia cargada" : "Subir constancia"}
                    valorInicial={inicial.constancia}
                    onCambio={(v) => set("constancia", v)}
                  />
                )}
              </FilaDocumento>
            )}

            {(!estudiando || !!inicial.credencial) && (
              <FilaDocumento
                estado={documentacion.credencial.estado}
                titulo={documentacion.credencial.nombre}
                detalle={documentacion.credencial.detalle}
                error={error("credencial")}
              >
                {documentacion.credencial.editable && (
                  <SubirArchivo
                    bucket="privado"
                    carpeta="documentos"
                    nombre="credencial"
                    etiqueta={documentacion.credencial.nombre}
                    variante="boton"
                    textoBoton={d.credencial ? "Archivo cargado" : "Subir archivo"}
                    valorInicial={inicial.credencial}
                    onCambio={(v) => set("credencial", v)}
                  />
                )}
              </FilaDocumento>
            )}

            <FilaDocumento estado={conductaEstado} titulo="Certificado de buena conducta" optativo detalle={DETALLE_CONDUCTA[conductaEstado]} error={error("conducta")}>
              <SubirArchivo
                bucket="privado"
                carpeta="documentos"
                nombre="conducta"
                etiqueta="certificado de buena conducta"
                variante="boton"
                textoBoton={d.conducta ? "Certificado cargado" : "Subir certificado"}
                valorInicial={inicial.conducta}
                onCambio={(v) => set("conducta", v)}
              />
            </FilaDocumento>
          </Tarjeta>

          {/* Datos de contacto y de trabajo */}
          <Tarjeta como="section" className="mb-4 p-[22px]">
            <h2 className={cn(TITULO_SECCION, "mb-3.5")}>Contacto y trabajo</h2>
            <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
              <Campo etiqueta="Teléfono o WhatsApp" error={error("telefono")} ayuda="Solo lo ven las instituciones a las que te postulás o les mandás tu CV.">
                <Input type="tel" autoComplete="tel" value={d.telefono} onChange={(e) => set("telefono", e.target.value)} />
              </Campo>
              <Campo etiqueta="Email" ayuda="Es el email de tu cuenta.">
                <Input type="email" value={emailCuenta} disabled readOnly />
              </Campo>
              <Campo etiqueta="Años de experiencia" error={error("aniosExperiencia")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  value={d.aniosExperiencia ?? ""}
                  onChange={(e) => set("aniosExperiencia", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Campo>
              <Campo etiqueta="Hasta dónde te movés" error={error("radioKm")} ayuda="Se usa para recomendarte búsquedas cercanas.">
                <Select value={d.radioKm} onChange={(e) => set("radioKm", Number(e.target.value))}>
                  {radios.map((km) => (
                    <option key={km} value={km}>
                      {km} km
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta como="section" className="mb-4 p-[22px]">
            <h2 className={cn(TITULO_SECCION, "mb-3")}>Resumen profesional</h2>
            <Textarea
              aria-label="Resumen profesional"
              aria-invalid={!!error("resumen")}
              value={d.resumen}
              onChange={(e) => set("resumen", e.target.value)}
              maxLength={1500}
              className="min-h-[90px] text-sm leading-[1.6]"
            />
            {error("resumen") && (
              <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
                {error("resumen")}
              </p>
            )}
          </Tarjeta>

          <Tarjeta como="section" className="mb-4 p-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className={TITULO_SECCION}>Experiencia</h2>
              <button
                type="button"
                onClick={() => set("experiencia", [...d.experiencia, { titulo: "", fechas: "", desc: "" }])}
                className={ACCION_TEXTO}
              >
                + agregar
              </button>
            </div>
            {d.experiencia.length === 0 ? (
              <p className="m-0 text-[13px] leading-normal text-apagado">
                Sumá tus trabajos anteriores: es lo primero que lee una institución.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                {d.experiencia.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-2 size-[9px] flex-none rounded-full bg-navy-700" />
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Puesto de la experiencia ${i + 1}`}
                        placeholder="Título del puesto"
                        value={e.titulo}
                        onChange={(ev) => actualizarExperiencia(i, "titulo", ev.target.value)}
                        className={cn(EN_LINEA, "-ml-1.5 mb-0.5 text-sm leading-[1.3] font-semibold")}
                      />
                      <input
                        aria-label={`Fechas de la experiencia ${i + 1}`}
                        placeholder="Fechas, ej. 2021 – actualidad"
                        value={e.fechas}
                        onChange={(ev) => actualizarExperiencia(i, "fechas", ev.target.value)}
                        className={cn(EN_LINEA, "-ml-1.5 mb-1 text-xs leading-[1.4] text-sutil")}
                      />
                      <Textarea
                        aria-label={`Descripción de la experiencia ${i + 1}`}
                        placeholder="Qué hacías, con qué grupos…"
                        value={e.desc}
                        onChange={(ev) => actualizarExperiencia(i, "desc", ev.target.value)}
                        className="min-h-[44px] text-[13px] leading-normal"
                      />
                      <button
                        type="button"
                        onClick={() => set("experiencia", d.experiencia.filter((_, j) => j !== i))}
                        className="mt-1 cursor-pointer rounded text-xs font-medium text-sutil hover:text-tinta hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {error("experiencia") && (
              <p role="alert" className="m-0 mt-2 text-xs text-[#b91c1c]">
                {error("experiencia")}
              </p>
            )}
          </Tarjeta>

          <div className="mb-4 flex gap-4 max-[860px]:flex-col">
            <Tarjeta como="section" className="flex-1 p-[22px]">
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className={TITULO_SECCION}>Formación</h2>
                <button
                  type="button"
                  onClick={() => set("formacion", [...d.formacion, { titulo: "", detalle: "" }])}
                  className={ACCION_TEXTO}
                >
                  + agregar
                </button>
              </div>
              {d.formacion.length === 0 ? (
                <p className="m-0 text-[13px] leading-normal text-apagado">Títulos, profesorados y certificaciones.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {d.formacion.map((f, i) => (
                    <li key={i}>
                      <input
                        aria-label={`Título de la formación ${i + 1}`}
                        placeholder="Título de la formación"
                        value={f.titulo}
                        onChange={(ev) => actualizarFormacion(i, "titulo", ev.target.value)}
                        className="mb-1 w-full rounded-md border border-borde bg-[#FAFAF8] px-2 py-1.5 text-[13px] leading-[1.3] font-semibold text-tinta transition-colors placeholder:text-sutil hover:border-sutil focus:border-navy-700 focus:bg-white focus:outline-none"
                      />
                      <input
                        aria-label={`Detalle de la formación ${i + 1}`}
                        placeholder="Institución y año"
                        value={f.detalle}
                        onChange={(ev) => actualizarFormacion(i, "detalle", ev.target.value)}
                        className="w-full rounded-md border border-borde bg-[#FAFAF8] px-2 py-1.5 text-xs leading-[1.4] text-apagado transition-colors placeholder:text-sutil hover:border-sutil focus:border-navy-700 focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => set("formacion", d.formacion.filter((_, j) => j !== i))}
                        className="mt-1 cursor-pointer rounded text-xs font-medium text-sutil hover:text-tinta hover:underline"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta como="section" className="flex-1 p-[22px]">
              <h2 className={cn(TITULO_SECCION, "mb-3.5")}>Asignaturas y niveles</h2>
              <div className="mb-2 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">Asignaturas</div>
              <div className="mb-4">
                <PerfilEtiquetas
                  items={d.asignaturas}
                  onCambiar={(a) => set("asignaturas", a)}
                  sugerencias={sugerencias.asignaturas}
                  textoAgregar="agregar"
                  etiquetaCampo="Agregar una asignatura"
                  max={25}
                />
              </div>
              <div className="mb-2 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">Niveles</div>
              <div className="flex flex-wrap gap-1.5">
                {niveles.map((n) => {
                  const marcado = d.niveles.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => set("niveles", marcado ? d.niveles.filter((x) => x !== n) : [...d.niveles, n])}
                      className={cn(
                        "inline-flex cursor-pointer items-center rounded-full px-2.5 py-[5px] text-xs leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
                        marcado ? "bg-navy-50 text-navy-700" : "bg-[#F0EFEA] text-apagado hover:bg-[#E6E4DD]",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </Tarjeta>
          </div>

          {cursosHechos}

          <Tarjeta como="section" className="p-[22px]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-1.5">
              <h2 className={TITULO_SECCION}>Disponibilidad horaria</h2>
              <span className="text-xs leading-none text-sutil">Marcá tu disponibilidad horaria</span>
            </div>
            <PerfilDisponibilidad grilla={d.grilla} onCambiar={(g) => set("grilla", g)} />
          </Tarjeta>
        </div>

        <aside className="flex w-[280px] flex-none flex-col gap-4 max-[1000px]:w-full">
          {lateral}
          {compartir}
          <details open className="group rounded-lg border border-borde bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-4 py-3.5 text-[15px] leading-none font-semibold focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              CV
              <Icono nombre="chevron" className="text-apagado transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-borde p-4">
              <p className="m-0 mb-3 text-[13px] leading-normal text-apagado">
                Armamos tu CV con los datos de tu perfil: experiencia, formación, asignaturas y cursos. Se genera con lo
                último que guardaste.
              </p>
              <BotonLink href="/docente/perfil/cv?imprimir=1" target="_blank" rel="noopener" variante="secundario" bloque>
                Descargar CV en PDF
              </BotonLink>
              <div className="mt-4 border-t border-[#F0EFEA] pt-4">
                <SubirArchivo
                  bucket="privado"
                  carpeta="cv"
                  nombre="cvUrl"
                  etiqueta="Tu propio CV (PDF)"
                  titulo="Subí tu CV en PDF"
                  variante="zona"
                  valorInicial={inicial.cvUrl}
                  onCambio={(v) => set("cvUrl", v)}
                />
                {cvEnlace && d.cvUrl === inicial.cvUrl && (
                  <a
                    href={cvEnlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-block text-[13px] font-medium text-navy-700 hover:underline"
                  >
                    Ver el CV que subiste
                  </a>
                )}
                {error("cvUrl") && (
                  <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
                    {error("cvUrl")}
                  </p>
                )}
              </div>
            </div>
          </details>
        </aside>
      </div>

      <div className="mt-[22px] flex items-center justify-end gap-3.5 border-t border-borde pt-[18px] max-[860px]:flex-col max-[860px]:items-stretch">
        <span className="text-[13px] leading-snug text-apagado max-[860px]:text-center">
          Los cambios se ven en las instituciones que te buscan.
        </span>
        <Boton type="submit" tamano="lg" disabled={pendiente} aria-busy={pendiente} className="min-w-[200px]">
          {pendiente ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </form>
  );
}
