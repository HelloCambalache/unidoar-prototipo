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


const TITULO_SECCION = "font-display m-0 text-[18px] leading-tight font-semibold text-navy-900";
/** Botón "Agregar" de las listas (experiencia, formación). */
const ACCION_AGREGAR =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-linea bg-white px-3.5 text-[13px] leading-none font-semibold text-tinta transition-colors hover:bg-lienzo focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";
/** Tarjeta de sección de la identidad nueva; `scroll-mt` para que los enlaces del índice no queden debajo de la barra. */
const SECCION = "scroll-mt-6 rounded-panel border-0 p-6 shadow-tarjeta";
const QUITAR =
  "cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-apagado hover:bg-lienzo hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

/** Secciones del formulario: el índice de la columna lateral y los pendientes de "Completá tu perfil" llevan acá. */
const SECCIONES = [
  { id: "datos", texto: "Tus datos" },
  { id: "documentacion", texto: "Verificación" },
  { id: "contacto", texto: "Contacto y trabajo" },
  { id: "resumen", texto: "Resumen" },
  { id: "experiencia", texto: "Experiencia" },
  { id: "formacion", texto: "Formación" },
  { id: "asignaturas", texto: "Asignaturas y niveles" },
  { id: "disponibilidad", texto: "Disponibilidad" },
  { id: "cv", texto: "CV" },
];

const ESTADO_DOC: Record<EstadoDocumento, { texto: string; clase: string }> = {
  verificado: { texto: "Verificado", clase: "bg-verde-tint text-verde" },
  revision: { texto: "En revisión", clase: "bg-[#FDF1C7] text-[#7A5900]" },
  sin: { texto: "Sin cargar", clase: "bg-white text-apagado border border-linea" },
};

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

/** Una fila de documentación: ícono y estado, qué es, en qué está y los botones para cargarlo. */
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
  const e = ESTADO_DOC[estado];
  return (
    <div id={id} className="flex scroll-mt-6 flex-wrap items-center gap-3.5 rounded-interno bg-[#F7F6F2] px-4 py-3.5">
      <span
        aria-hidden
        className={cn(
          "inline-flex size-10 flex-none items-center justify-center rounded-[12px]",
          estado === "verificado" ? "bg-verde-tint text-verde" : "bg-white text-apagado",
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9.5 14.5l1.8 1.8 3.2-3.6" />
        </svg>
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[14.5px] leading-[1.3] font-semibold">
          {titulo}
          <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold", e.clase)}>{e.texto}</span>
          {optativo && <span className="text-[12px] font-medium text-apagado">Optativo</span>}
        </div>
        <div className="text-[13px] leading-[1.45] text-apagado">{detalle}</div>
        {error && (
          <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
            {error}
          </p>
        )}
      </div>
      {children && <div className="flex flex-none flex-wrap gap-2">{children}</div>}
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

  // Lo último que se guardó, para avisar si hay cambios sin guardar. Se toma al mandar el formulario y se confirma si sale bien.
  const [guardado, setGuardado] = useState(() => JSON.stringify(inicial));
  const [enviado, setEnviado] = useState<string | null>(null);
  // Cuando llega un resultado nuevo y salió bien, lo enviado pasa a ser lo guardado (ajuste durante el render, sin efecto).
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado?.ok && enviado) setGuardado(enviado);
  }
  const sinGuardar = JSON.stringify(d) !== guardado;

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
    <form action={accion} onSubmit={() => setEnviado(JSON.stringify(d))}>
      <input type="hidden" name="datos" value={JSON.stringify(d)} />

      <div className="flex items-start gap-6 max-[1000px]:flex-wrap max-[860px]:flex-col max-[860px]:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-5 max-[860px]:w-full">
          {/* Tus datos: foto, nombre, título y zonas */}
          <Tarjeta como="section" id="datos" className={cn(SECCION, "p-2.5")}>
            <div className="flex gap-6 rounded-interno bg-[#F7F6F2] px-6 py-6 max-[560px]:flex-col max-[560px]:px-4">
              <SubirArchivo
                bucket="publico"
                carpeta="fotos"
                nombre="fotoUrl"
                etiqueta="Foto"
                ayuda=""
                variante="circulo"
                valorInicial={inicial.fotoUrl}
                onCambio={(v) => set("fotoUrl", v)}
                className="w-[112px] flex-none"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {identidadFija ? (
                  <div>
                    {/* Con el DNI verificado el nombre es el del documento: se muestra fijo y solo lo corrige el equipo. */}
                    <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <h2 className="font-display m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
                        {`${inicial.nombre} ${inicial.apellido}`.trim()}
                      </h2>
                      <Insignia tono={insignia.tono} className="flex-none">
                        {insignia.texto}
                      </Insignia>
                    </div>
                    <p className="m-0 text-xs leading-normal text-apagado">
                      Tu nombre ya está verificado con tu DNI, por eso no se puede cambiar. Si hay un error,{" "}
                      <Link href="/contacto" className="font-medium">
                        escribinos desde Contacto
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Insignia tono={insignia.tono} className="flex-none">
                        {insignia.texto}
                      </Insignia>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
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
                  </>
                )}
                <Campo etiqueta="Título de tu perfil" ayuda="Es lo primero que leen las instituciones debajo de tu nombre.">
                  <Input
                    placeholder="Ej. Profesora de Ed. Física · 12 años de experiencia"
                    value={d.subtitulo}
                    onChange={(e) => set("subtitulo", e.target.value)}
                  />
                </Campo>
                <div>
                  <div className="mb-2 text-[13px] font-semibold text-tinta">Zonas donde trabajás</div>
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
          </Tarjeta>

          {/* Verificación y documentación */}
          <Tarjeta como="section" id="documentacion" className={cn(SECCION, "flex flex-col gap-3")}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={TITULO_SECCION}>Verificación y documentación</h2>
              <span className="text-[13px] text-apagado">Solo lo ve el equipo de UNIDOAR</span>
            </div>
            {verificacion}

            <FilaDocumento
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
              <div className="rounded-interno border border-linea px-4 py-4">
                <div className="mb-3 text-[14.5px] leading-[1.3] font-semibold">Tus estudios</div>
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

            <FilaDocumento
              estado={conductaEstado}
              titulo="Certificado de buena conducta"
              optativo
              detalle={DETALLE_CONDUCTA[conductaEstado]}
              error={error("conducta")}
            >
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
          <Tarjeta como="section" id="contacto" className={SECCION}>
            <h2 className={cn(TITULO_SECCION, "mb-4")}>Contacto y trabajo</h2>
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

          <Tarjeta como="section" id="resumen" className={SECCION}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={TITULO_SECCION}>Resumen profesional</h2>
              <span className="text-xs text-apagado">{d.resumen.length} / 1500</span>
            </div>
            <Textarea
              aria-label="Resumen profesional"
              aria-invalid={!!error("resumen")}
              placeholder="Contá en pocas líneas cómo trabajás, con qué grupos y qué te interesa."
              value={d.resumen}
              onChange={(e) => set("resumen", e.target.value)}
              maxLength={1500}
              className="min-h-[110px] text-sm leading-[1.6]"
            />
            {error("resumen") && (
              <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
                {error("resumen")}
              </p>
            )}
          </Tarjeta>

          <Tarjeta como="section" id="experiencia" className={SECCION}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className={TITULO_SECCION}>Experiencia</h2>
              <button
                type="button"
                onClick={() => set("experiencia", [...d.experiencia, { titulo: "", fechas: "", desc: "" }])}
                className={ACCION_AGREGAR}
              >
                <Icono nombre="mas" tamano={14} trazo={2.2} />
                Agregar
              </button>
            </div>
            {d.experiencia.length === 0 ? (
              <p className="m-0 rounded-interno border border-dashed border-[#CFCBC3] px-4 py-5 text-center text-[13px] leading-normal text-apagado">
                Sumá tus trabajos anteriores: es lo primero que lee una institución.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {d.experiencia.map((e, i) => (
                  <li key={i} className="flex gap-3 rounded-interno bg-[#F7F6F2] p-4">
                    <span aria-hidden className={cn("mt-2 size-2.5 flex-none rounded-full", i === 0 ? "bg-rosa" : "bg-[#C9C6C0]")} />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="grid grid-cols-[2fr_1fr] gap-2 max-[560px]:grid-cols-1">
                        <Input
                          aria-label={`Puesto de la experiencia ${i + 1}`}
                          placeholder="Título del puesto"
                          value={e.titulo}
                          onChange={(ev) => actualizarExperiencia(i, "titulo", ev.target.value)}
                          className="font-semibold"
                        />
                        <Input
                          aria-label={`Fechas de la experiencia ${i + 1}`}
                          placeholder="Ej. 2021 – actualidad"
                          value={e.fechas}
                          onChange={(ev) => actualizarExperiencia(i, "fechas", ev.target.value)}
                        />
                      </div>
                      <Textarea
                        aria-label={`Descripción de la experiencia ${i + 1}`}
                        placeholder="Qué hacías, con qué grupos…"
                        value={e.desc}
                        onChange={(ev) => actualizarExperiencia(i, "desc", ev.target.value)}
                        className="min-h-[60px] text-[13px] leading-normal"
                      />
                      <button
                        type="button"
                        onClick={() => set("experiencia", d.experiencia.filter((_, j) => j !== i))}
                        className={cn(QUITAR, "self-end")}
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

          <div className="flex gap-5 max-[860px]:flex-col">
            <Tarjeta como="section" id="formacion" className={cn(SECCION, "flex-1")}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className={TITULO_SECCION}>Formación</h2>
                <button
                  type="button"
                  onClick={() => set("formacion", [...d.formacion, { titulo: "", detalle: "" }])}
                  className={ACCION_AGREGAR}
                >
                  <Icono nombre="mas" tamano={14} trazo={2.2} />
                  Agregar
                </button>
              </div>
              {d.formacion.length === 0 ? (
                <p className="m-0 rounded-interno border border-dashed border-[#CFCBC3] px-4 py-5 text-center text-[13px] leading-normal text-apagado">
                  Títulos, profesorados y certificaciones.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {d.formacion.map((f, i) => (
                    <li key={i} className="flex flex-col gap-2 rounded-interno bg-[#F7F6F2] p-3.5">
                      <Input
                        aria-label={`Título de la formación ${i + 1}`}
                        placeholder="Título de la formación"
                        value={f.titulo}
                        onChange={(ev) => actualizarFormacion(i, "titulo", ev.target.value)}
                        className="font-semibold"
                      />
                      <Input
                        aria-label={`Detalle de la formación ${i + 1}`}
                        placeholder="Institución y año"
                        value={f.detalle}
                        onChange={(ev) => actualizarFormacion(i, "detalle", ev.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => set("formacion", d.formacion.filter((_, j) => j !== i))}
                        className={cn(QUITAR, "self-end")}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta como="section" id="asignaturas" className={cn(SECCION, "flex-1")}>
              <h2 className={cn(TITULO_SECCION, "mb-4")}>Asignaturas y niveles</h2>
              <div className="mb-2 text-[13px] font-semibold text-tinta">Asignaturas</div>
              <div className="mb-5">
                <PerfilEtiquetas
                  items={d.asignaturas}
                  onCambiar={(a) => set("asignaturas", a)}
                  sugerencias={sugerencias.asignaturas}
                  textoAgregar="agregar"
                  etiquetaCampo="Agregar una asignatura"
                  max={25}
                />
              </div>
              <div className="mb-2 text-[13px] font-semibold text-tinta">Niveles</div>
              <div className="flex flex-wrap gap-2">
                {niveles.map((n) => {
                  const marcado = d.niveles.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => set("niveles", marcado ? d.niveles.filter((x) => x !== n) : [...d.niveles, n])}
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
                        marcado ? "bg-navy-900 text-white" : "border border-linea bg-white text-tinta-2 hover:bg-lienzo",
                      )}
                    >
                      {marcado && <Icono nombre="tilde" tamano={12} trazo={2.6} />}
                      {n}
                    </button>
                  );
                })}
              </div>
            </Tarjeta>
          </div>

          {cursosHechos}

          <Tarjeta como="section" id="disponibilidad" className={SECCION}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-1.5">
              <h2 className={TITULO_SECCION}>Disponibilidad horaria</h2>
              <span className="text-[13px] leading-none text-apagado">Tocá los turnos en los que podés trabajar</span>
            </div>
            <PerfilDisponibilidad grilla={d.grilla} onCambiar={(g) => set("grilla", g)} />
          </Tarjeta>
        </div>

        <aside className="flex w-[300px] flex-none flex-col gap-5 max-[1000px]:w-full">
          {lateral}

          <nav aria-label="Secciones de tu perfil" className="rounded-panel bg-white p-3 shadow-tarjeta max-[1000px]:hidden">
            <div className="px-3 pt-2 pb-2 text-[12px] font-semibold tracking-[.08em] text-apagado uppercase">En esta página</div>
            <ul className="m-0 flex list-none flex-col p-0">
              {SECCIONES.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex min-h-10 items-center rounded-[12px] px-3 text-[14px] font-medium text-tinta-2 hover:bg-lienzo hover:text-tinta"
                  >
                    {s.texto}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {compartir}

          <section id="cv" className="scroll-mt-6 rounded-panel bg-white p-5 shadow-tarjeta">
            <h2 className="font-display m-0 mb-2 text-[17px] font-semibold text-navy-900">CV</h2>
            <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
              Armamos tu CV con los datos de tu perfil: experiencia, formación, asignaturas y cursos. Se genera con lo último que
              guardaste.
            </p>
            <BotonLink
              href="/docente/perfil/cv?imprimir=1"
              target="_blank"
              rel="noopener"
              variante="secundario"
              bloque
              className="rounded-full"
            >
              Descargar CV en PDF
            </BotonLink>
            <div className="mt-4 border-t border-linea pt-4">
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
          </section>
        </aside>
      </div>

      {/* Barra de guardado: queda pegada abajo mientras se edita y avisa si hay cambios sin guardar. */}
      <div className="sticky bottom-0 z-20 mt-6 pb-3">
        <div
          className={cn(
            "flex items-center justify-end gap-3.5 rounded-interno bg-white px-5 py-3 shadow-[0_-1px_0_rgba(4,11,53,.04),0_10px_30px_rgba(4,11,53,.14)] max-[560px]:flex-col max-[560px]:items-stretch",
          )}
        >
          <span
            role="status"
            className={cn(
              "flex items-center gap-2 text-[13.5px] leading-snug max-[560px]:justify-center",
              sinGuardar ? "font-semibold text-tinta" : "text-apagado",
            )}
          >
            {sinGuardar && <span aria-hidden className="size-2 flex-none rounded-full bg-naranja" />}
            {sinGuardar ? "Tenés cambios sin guardar" : "Los cambios se ven en las instituciones que te buscan."}
          </span>
          <Boton
            type="submit"
            tamano="lg"
            disabled={pendiente}
            aria-busy={pendiente}
            className="min-w-[200px] rounded-full bg-rosa hover:bg-[#7A0F4D]"
          >
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </Boton>
        </div>
      </div>
    </form>
  );
}
