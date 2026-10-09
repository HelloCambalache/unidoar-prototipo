"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  agendarEntrevista,
  agregarArchivoExamen,
  agregarNotaInstitucion,
  borrarNotaInstitucion,
  marcarExamenPreocupacional,
  quitarArchivoExamen,
  quitarEntrevista,
  toggleFavoritoDocente,
} from "@/app/actions/pipeline";
import { Boton, BotonLink, botonClases } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { Cajon } from "@/components/ui/cajon";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import type { EtapaPostulacion } from "@/db/schema";
import { ETAPA_LABEL } from "@/lib/catalogo";
import { etiquetaDeEstudiante } from "@/lib/estudiantes";
import { CARPETA_EXAMEN, MAX_ARCHIVOS_EXAMEN, puedeAdjuntarAlExamen } from "@/lib/examen-preocupacional";
import { enlaceWhatsapp, ETAPA_MENU, INSIGNIA_ETAPA, type PostulanteTarjeta } from "@/lib/pipeline";
import { ETAPAS_MOVIBLES } from "@/lib/postulaciones";
import { cn } from "@/lib/utils";

const ETAPAS_DEL_SELECT: EtapaPostulacion[] = [...ETAPAS_MOVIBLES, "contratado", "descartado"];

/**
 * Cajón lateral con la ficha de un postulante: CV, mover de etapa, favorito, notas internas,
 * entrevista y Contratar. Las acciones sobre la etapa las resuelve el tablero (`onMover`),
 * así el cajón y las tarjetas comparten el mismo flujo optimista.
 */
export function CajonPostulante({
  postulante,
  busquedaId,
  soloLectura,
  onCerrar,
  onMover,
}: {
  postulante: PostulanteTarjeta | null;
  busquedaId: string;
  soloLectura: boolean;
  onCerrar: () => void;
  onMover: (postulacionId: string, etapa: EtapaPostulacion) => void;
}) {
  return (
    <Cajon abierto={!!postulante} onCerrar={onCerrar} titulo={postulante ? `Ficha de ${postulante.nombre}` : "Ficha"} ancho={480}>
      {postulante && (
        <Ficha key={postulante.id} p={postulante} busquedaId={busquedaId} soloLectura={soloLectura} onMover={onMover} />
      )}
    </Cajon>
  );
}

function Ficha({
  p,
  busquedaId,
  soloLectura,
  onMover,
}: {
  p: PostulanteTarjeta;
  busquedaId: string;
  soloLectura: boolean;
  onMover: (postulacionId: string, etapa: EtapaPostulacion) => void;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState("");
  const [titulo, setTitulo] = useState("");
  // Con una entrevista ya agendada, el formulario solo se abre al tocar "Editar" y arranca con lo que tiene cargado.
  const [editando, setEditando] = useState(false);
  const [esFavorito, setFavorito] = useOptimistic(p.esFavorito);
  const [examenHecho, setExamenHecho] = useOptimistic(p.examenPreocupacional !== null);

  const { cv } = p;
  const whatsapp = enlaceWhatsapp(cv.telefono);
  const insignia = INSIGNIA_ETAPA[p.etapa];
  const puedeAgendar = !soloLectura && p.etapa !== "descartado" && p.etapa !== "contratado";
  // El checklist "Para ingresar a trabajar" se edita en la etapa Examen preocupacional; después queda como registro.
  const puedeMarcarExamen = !soloLectura && p.etapa === "examen_preocupacional";
  const puedeAdjuntar = !soloLectura && puedeAdjuntarAlExamen(p.etapa);
  const mostrarChecklist = p.etapa === "examen_preocupacional" || p.examenPreocupacional !== null || p.examenArchivos.length > 0;
  // Cada archivo subido reinicia el botón de subida (si no, seguiría mostrando el "✓" del anterior).
  const [subidas, setSubidas] = useState(0);

  /** Corre una acción del servidor en una transición y avisa con un toast, sin dejar que un corte de red rompa la pantalla. */
  const correr = (tarea: () => Promise<{ ok: boolean; error?: string }>, exito?: string, alExito?: () => void) =>
    empezar(async () => {
      try {
        const r = await tarea();
        if (!r.ok) toast(r.error ?? "No pudimos completar la acción.", "error");
        else {
          if (exito) toast(exito);
          alExito?.();
        }
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });

  const alternarFavorito = () =>
    empezar(async () => {
      setFavorito(!esFavorito);
      try {
        const r = await toggleFavoritoDocente(p.docenteId);
        if (!r.ok) toast(r.error, "error");
        else toast(r.data.favorito ? "Guardado en tus favoritos" : "Quitado de tus favoritos");
      } catch {
        toast("No pudimos actualizar tus favoritos. Probá de nuevo.", "error");
      }
    });

  const alternarExamen = () =>
    empezar(async () => {
      const realizado = !examenHecho;
      setExamenHecho(realizado);
      try {
        const r = await marcarExamenPreocupacional(p.id, realizado);
        if (!r.ok) toast(r.error, "error");
        else toast(realizado ? "Anotaste que hizo el examen preocupacional." : "Quitaste el examen preocupacional.");
      } catch {
        toast("No pudimos guardar el cambio. Probá de nuevo.", "error");
      }
    });

  const adjuntarExamen = (path: string, nombre?: string) => {
    if (!path) return;
    correr(
      () => agregarArchivoExamen(p.id, path, nombre),
      "Archivo guardado.",
      () => setSubidas((n) => n + 1),
    );
  };
  const quitarExamen = (indice: number) => correr(() => quitarArchivoExamen(p.id, indice), "Archivo quitado.");

  const guardarNota = () => {
    const texto = nota.trim();
    if (texto) correr(() => agregarNotaInstitucion(p.id, texto), undefined, () => setNota(""));
  };

  const abrirEdicion = () => {
    setFecha(p.entrevista?.fechaLocal ?? "");
    setTitulo(p.entrevista?.titulo ?? "");
    setEditando(true);
  };
  const cerrarEdicion = () => {
    setFecha("");
    setTitulo("");
    setEditando(false);
  };

  const agendar = () => {
    if (!fecha) {
      toast("Elegí fecha y hora de la entrevista.", "error");
      return;
    }
    const reprograma = p.entrevista !== null && fecha !== p.entrevista.fechaLocal;
    correr(
      () => agendarEntrevista(p.id, { fecha, titulo: titulo.trim() || undefined }),
      p.entrevista === null
        ? "Entrevista agendada. Le avisamos al profesional."
        : reprograma
          ? "Entrevista reprogramada. Le avisamos al profesional."
          : "Entrevista actualizada.",
      cerrarEdicion,
    );
  };

  const borrarNota = (id: string) => correr(() => borrarNotaInstitucion(id));
  const quitar = () => correr(() => quitarEntrevista(p.id), "Entrevista quitada");

  return (
    <div className="flex flex-col gap-5" aria-busy={pendiente}>
      <div className="flex gap-3.5">
        <Avatar iniciales={p.iniciales} fotoUrl={p.fotoUrl} tamano={64} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[20px] leading-tight font-semibold tracking-[-0.015em]">{p.nombre}</h2>
          <div className="mt-1 text-[13px] leading-snug text-apagado">{cv.subtitulo ?? p.subtitulo}</div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.suspendido ? (
              <Insignia tono="rosa">Perfil suspendido</Insignia>
            ) : cv.verificado ? (
              <Insignia tono="verde">✓ Perfil verificado</Insignia>
            ) : (
              <Insignia>Sin verificar</Insignia>
            )}
            <Insignia tono={insignia.tono} className={insignia.clase}>
              {ETAPA_LABEL[p.etapa]}
            </Insignia>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 max-[420px]:grid-cols-1">
        <Dato etiqueta="Experiencia" valor={cv.aniosExperiencia != null ? `${cv.aniosExperiencia} ${cv.aniosExperiencia === 1 ? "año" : "años"}` : "—"} />
        <Dato etiqueta="Disponibilidad" valor={cv.disponibilidad.length ? cv.disponibilidad.join(" · ") : "—"} />
        <Dato etiqueta={p.origen === "invitacion" ? "Invitado" : "Se postuló"} valor={p.desde} />
      </div>

      {/* Acciones */}
      <section aria-label="Acciones" className="flex flex-col gap-2.5 rounded-ud border border-borde p-4">
        {!soloLectura && (
          <Campo etiqueta="Mover a etapa">
            <Select
              value={p.etapa}
              onChange={(e) => onMover(p.id, e.target.value as EtapaPostulacion)}
              disabled={pendiente}
            >
              {ETAPAS_DEL_SELECT.map((e) => (
                <option key={e} value={e}>
                  {ETAPA_MENU[e]}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        {!soloLectura && p.etapa !== "contratado" && p.etapa !== "descartado" && (
          <BotonLink href={`/institucion/contratar?postulacion=${p.id}`} variante="cta" bloque>
            Contratar
          </BotonLink>
        )}
        {!soloLectura && p.etapa === "descartado" && (
          <Boton variante="primario" bloque onClick={() => onMover(p.id, "nuevos")}>
            Recuperar postulación
          </Boton>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={botonClases({ variante: "secundario", bloque: true })}>
            Contactar por WhatsApp
          </a>
        )}
        <Boton variante="secundario" bloque onClick={alternarFavorito} aria-pressed={esFavorito}>
          {esFavorito ? "★ Quitar de favoritos" : "☆ Guardar en favoritos"}
        </Boton>
        <div className="flex flex-wrap gap-2.5">
          <BotonLink
            href={`/institucion/docente/${p.docenteId}?busqueda=${busquedaId}`}
            variante="secundario"
            tamano="sm"
            className="flex-1"
          >
            Ver perfil completo
          </BotonLink>
          {cv.cvUrl && (
            <a
              href={cv.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={botonClases({ variante: "secundario", tamano: "sm", className: "flex-1" })}
            >
              Descargar CV
            </a>
          )}
          {!soloLectura && p.etapa !== "descartado" && p.etapa !== "contratado" && (
            <Boton variante="fantasma" tamano="sm" className="text-[#b91c1c] hover:text-[#b91c1c]" onClick={() => onMover(p.id, "descartado")}>
              Archivar
            </Boton>
          )}
        </div>
      </section>

      {/* Contacto */}
      <section aria-label="Contacto" className="flex flex-col gap-2 text-[13px]">
        {p.suspendido ? (
          <p className="m-0 text-xs leading-normal text-apagado">
            El equipo de UNIDOAR suspendió este perfil: por ahora no mostramos su teléfono ni su email.
          </p>
        ) : (
          <>
            <Fila etiqueta="Teléfono" valor={cv.telefono} />
            <Fila etiqueta="Email" valor={cv.email} />
          </>
        )}
        <Fila etiqueta="Ubicación" valor={cv.ubicacion ?? (p.zonas.length ? p.zonas.join(", ") : null)} />
      </section>

      {p.mensaje && (
        <section>
          <EtiquetaSeccion>Mensaje de la postulación</EtiquetaSeccion>
          <p className="m-0 rounded-lg bg-superficie px-3.5 py-3 text-[13.5px] leading-normal whitespace-pre-wrap text-tinta-2">{p.mensaje}</p>
        </section>
      )}

      {/* Entrevista */}
      <section>
        <EtiquetaSeccion>Entrevista</EtiquetaSeccion>
        {p.entrevista && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-naranja-tint px-3.5 py-3 text-[13px] text-naranja-ink">
            <div>
              <div className="font-semibold">{p.entrevista.titulo ?? "Entrevista"}</div>
              <div className="mt-0.5">{p.entrevista.texto}</div>
            </div>
            {puedeAgendar && !editando && (
              <div className="flex flex-none gap-3">
                <button type="button" onClick={abrirEdicion} disabled={pendiente} className="text-[12.5px] font-semibold underline underline-offset-2 disabled:opacity-50">
                  Editar
                </button>
                <button type="button" onClick={quitar} disabled={pendiente} className="text-[12.5px] font-semibold underline underline-offset-2 disabled:opacity-50">
                  Quitar
                </button>
              </div>
            )}
          </div>
        )}
        {!p.entrevista && !puedeAgendar && <p className="m-0 text-[13px] text-sutil">No hay una entrevista agendada.</p>}
        {puedeAgendar && (!p.entrevista || editando) && (
          <div className="flex flex-col gap-2.5">
            <Campo etiqueta="Fecha y hora (hora de Argentina)">
              <Input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo etiqueta="Título (opcional)">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ej. Entrevista en el colegio" />
            </Campo>
            <div className="flex flex-wrap gap-2.5">
              <Boton variante="primario" tamano="sm" onClick={agendar} disabled={pendiente}>
                {p.entrevista ? "Guardar cambios" : "Agendar entrevista"}
              </Boton>
              {editando && (
                <Boton variante="secundario" tamano="sm" onClick={cerrarEdicion} disabled={pendiente}>
                  Cancelar
                </Boton>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Checklist para ingresar a trabajar */}
      {mostrarChecklist && (
        <section>
          <EtiquetaSeccion>Para ingresar a trabajar</EtiquetaSeccion>
          <label
            className={cn(
              "flex items-start gap-2.5 rounded-lg border border-borde px-3.5 py-3 text-[13.5px] leading-snug",
              puedeMarcarExamen ? "cursor-pointer" : "cursor-default",
              examenHecho && "bg-[#E4F3EA]",
            )}
          >
            <input
              type="checkbox"
              checked={examenHecho}
              onChange={alternarExamen}
              disabled={!puedeMarcarExamen || pendiente}
              className="mt-0.5 size-4 flex-none accent-navy-700"
            />
            <span>
              <span className="block font-semibold">Hizo el examen preocupacional</span>
              <span className="mt-0.5 block text-[12.5px] text-apagado">
                {examenHecho
                  ? p.examenPreocupacional
                    ? `Anotado el ${p.examenPreocupacional.cuando}`
                    : "Anotado"
                  : "Tildalo cuando tengas el estudio."}
              </span>
            </span>
          </label>

          {(p.examenArchivos.length > 0 || puedeAdjuntar) && (
            <div className="mt-2.5 flex flex-col gap-2">
              <div className="text-[12.5px] font-semibold text-apagado">Archivos del estudio</div>
              {p.examenArchivos.length === 0 && <p className="m-0 text-[12.5px] text-sutil">Todavía no guardaste ninguno.</p>}
              {p.examenArchivos.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {p.examenArchivos.map((a, i) => (
                    <li key={`${i}-${a.nombre}`} className="flex items-center gap-2.5 rounded-lg border border-borde px-3 py-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate font-medium" title={a.nombre}>
                        {a.nombre}
                      </span>
                      <a
                        href={`/api/examen-preocupacional/${p.id}/${i}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver ${a.nombre}`}
                        className="flex-none text-[12.5px] font-semibold text-navy-700 underline underline-offset-2"
                      >
                        Ver
                      </a>
                      {puedeAdjuntar && (
                        <button
                          type="button"
                          onClick={() => quitarExamen(i)}
                          disabled={pendiente}
                          aria-label={`Quitar ${a.nombre}`}
                          className="flex-none text-[12.5px] font-semibold text-[#b91c1c] underline underline-offset-2 disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {puedeAdjuntar && p.examenArchivos.length < MAX_ARCHIVOS_EXAMEN && (
                <SubirArchivo
                  key={subidas}
                  bucket="privado"
                  carpeta={CARPETA_EXAMEN}
                  nombre="archivoExamen"
                  etiqueta="archivo del examen preocupacional"
                  variante="boton"
                  textoBoton="Adjuntar archivo"
                  onCambio={adjuntarExamen}
                />
              )}
              <p className="m-0 text-[11.5px] leading-snug text-sutil">
                PDF o foto, hasta {MAX_ARCHIVOS_EXAMEN} archivos. Es información de salud: queda en un espacio privado y solo la ve tu institución.
              </p>
            </div>
          )}
        </section>
      )}

      {/* CV */}
      {cv.resumen && (
        <section>
          <EtiquetaSeccion>Resumen profesional</EtiquetaSeccion>
          <p className="m-0 text-[13.5px] leading-[1.6] text-tinta-2">{cv.resumen}</p>
        </section>
      )}

      {cv.experiencia.length > 0 && (
        <section>
          <EtiquetaSeccion>Experiencia</EtiquetaSeccion>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {cv.experiencia.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 size-[9px] flex-none rounded-full bg-navy-700" />
                <div>
                  <div className="text-sm leading-tight font-semibold">{e.titulo}</div>
                  <div className="mt-0.5 text-xs text-sutil">{e.fechas}</div>
                  <div className="mt-1 text-[13px] leading-normal text-tinta-2">{e.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cv.formacion.length > 0 && (
        <section>
          <EtiquetaSeccion>Formación</EtiquetaSeccion>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {cv.formacion.map((f, i) => (
              <li key={i}>
                <div className="text-[13px] leading-tight font-semibold">{f.titulo}</div>
                <div className="mt-0.5 text-xs text-sutil">{f.detalle}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(cv.asignaturas.length > 0 || cv.niveles.length > 0) && (
        <section>
          <EtiquetaSeccion>Asignaturas y niveles</EtiquetaSeccion>
          <div className="flex flex-wrap gap-1.5">
            {[...cv.asignaturas, ...cv.niveles].map((t) => (
              <Insignia key={t}>{t}</Insignia>
            ))}
          </div>
        </section>
      )}

      <section>
        <EtiquetaSeccion>Estado de verificación</EtiquetaSeccion>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
          <Verificacion ok={cv.verificado} texto="Identidad (DNI)" />
          <Verificacion ok={cv.antecedentesVerificados} texto="Certificado de buena conducta" />
          {cv.estudiante ? (
            // Quien todavía estudia no tiene título: se muestra cuánto de la carrera lleva y que el equipo revisa la constancia con el DNI.
            <Verificacion ok={cv.verificado} texto={`${etiquetaDeEstudiante(cv.estudiante.porcentaje)} · constancia de alumno regular`} />
          ) : (
            <Verificacion ok={cv.tituloVerificado} texto="Título" />
          )}
        </ul>
      </section>

      {/* Notas */}
      <section>
        <EtiquetaSeccion>Notas para el equipo</EtiquetaSeccion>
        {p.notas.length > 0 && (
          <ul className="mb-3 flex list-none flex-col gap-2 p-0">
            {p.notas.map((n) => (
              <li key={n.id} className="rounded-lg bg-superficie px-3.5 py-3">
                <p className="m-0 text-[13px] leading-normal whitespace-pre-wrap text-tinta">{n.texto}</p>
                <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-sutil">
                  <span>
                    {n.autor ?? "Ex integrante del equipo"} · {n.cuando}
                  </span>
                  <button
                    type="button"
                    onClick={() => borrarNota(n.id)}
                    disabled={pendiente}
                    aria-label="Borrar nota"
                    className="font-medium underline underline-offset-2 hover:text-tinta disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Campo etiqueta="Nueva nota" ayuda="Solo la ve tu equipo, el profesional no.">
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={1000}
            className="min-h-[80px]"
            placeholder="Ej. Tenemos entrevista el 23/10"
          />
        </Campo>
        <Boton variante="secundario" tamano="sm" onClick={guardarNota} disabled={pendiente || !nota.trim()} className="mt-2.5">
          Guardar nota
        </Boton>
      </section>

    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-borde bg-superficie px-3.5 py-3">
      <div className="mb-1 text-[11px] leading-none font-semibold tracking-[.05em] text-sutil uppercase">{etiqueta}</div>
      <div className="text-[13.5px] leading-tight font-semibold text-tinta">{valor}</div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-apagado">{etiqueta}</span>
      <span className="min-w-0 text-right font-semibold break-words">{valor ?? "—"}</span>
    </div>
  );
}

function Verificacion({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className={cn("flex items-center gap-2", !ok && "text-sutil")}>
      {ok ? (
        <span className="inline-flex size-[18px] flex-none items-center justify-center rounded-full bg-verde text-white">
          <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      ) : (
        <span aria-hidden className="size-[18px] flex-none rounded-full border-[1.5px] border-dashed border-borde-fuerte" />
      )}
      {texto}
      <span className="sr-only">{ok ? " verificado" : " sin verificar"}</span>
    </li>
  );
}
