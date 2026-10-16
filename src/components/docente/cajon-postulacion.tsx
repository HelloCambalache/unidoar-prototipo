"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  agendarDocente,
  agregarNotaDocente,
  borrarNotaDocente,
  quitarAgendaDocente,
  retirarPostulacion,
} from "@/app/actions/postulaciones";
import { Icono } from "@/components/icons";
import { Boton, BotonLink, botonClases } from "@/components/ui/button";
import { Cajon } from "@/components/ui/cajon";
import { Input, Textarea } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/insignia";
import { useToast } from "@/components/ui/toast";
import { RespuestaEntrevista } from "@/components/docente/respuesta-entrevista";
import type { RespuestaEntrevista as RespuestaEntrevistaElegida } from "@/lib/entrevista-respuesta";
import type { DetallePostulacion } from "@/lib/queries/postulaciones";
import { cn } from "@/lib/utils";

const ETIQUETA = "text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase";

/**
 * Cajón de detalle de una postulación (se abre con ?abrir=<id>): puesto, contacto, agenda personal
 * y notas privadas. El estado vive en la base: cada acción revalida la página y el cajón se repinta.
 */
export function CajonPostulacion({
  detalle,
  cerrarHref,
  respuestaSugerida = null,
}: {
  detalle: DetallePostulacion;
  cerrarHref: string;
  /** Lo que eligió en el mail de la entrevista (`?entrevista=voy|no-puedo`): solo preselecciona. */
  respuestaSugerida?: RespuestaEntrevistaElegida | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, empezar] = useTransition();

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  const [confirmandoRetiro, setConfirmandoRetiro] = useState(false);
  const [error, setError] = useState<{ agenda?: string; nota?: string; retiro?: string }>({});

  const cerrar = useCallback(() => router.replace(cerrarHref, { scroll: false }), [router, cerrarHref]);

  const agendar = () =>
    empezar(async () => {
      const r = await agendarDocente(detalle.id, { fecha, hora, titulo });
      if (!r.ok) return setError({ agenda: r.campos ? Object.values(r.campos)[0] : r.error });
      setError({});
      setFecha("");
      setHora("");
      setTitulo("");
      toast("Agendado");
    });

  const quitarAgenda = () =>
    empezar(async () => {
      const r = await quitarAgendaDocente(detalle.id);
      if (!r.ok) return toast(r.error, "error");
      toast("Quitamos el evento de tu agenda");
    });

  const guardarNota = () =>
    empezar(async () => {
      const r = await agregarNotaDocente(detalle.id, nota);
      if (!r.ok) return setError({ nota: r.error });
      setError({});
      setNota("");
      toast("Nota guardada");
    });

  const borrarNota = (id: string) =>
    empezar(async () => {
      const r = await borrarNotaDocente(id);
      if (!r.ok) toast(r.error, "error");
    });

  const retirar = () =>
    empezar(async () => {
      const r = await retirarPostulacion(detalle.id);
      if (!r.ok) {
        setConfirmandoRetiro(false);
        return setError({ retiro: r.error });
      }
      toast("Retiraste tu postulación");
      cerrar();
    });

  const agendaCompleta = fecha !== "" && hora !== "" && titulo.trim().length >= 2;

  return (
    <Cajon abierto onCerrar={cerrar} titulo={`${detalle.puesto} en ${detalle.institucion.nombre}`}>
      <h2 className="m-0 mb-1.5 text-lg leading-[1.25] font-semibold">{detalle.puesto}</h2>
      <div className="mb-3.5 text-[13px] leading-[1.4] text-apagado">{detalle.institucion.nombre}</div>
      <Insignia tono={detalle.estado.tono} className="mb-2 self-start">
        {detalle.estado.texto}
      </Insignia>
      <div className="mb-5 text-xs leading-[1.4] text-sutil">{detalle.envio}</div>

      {detalle.examenPreocupacional && detalle.estado.activa && (
        <p className="m-0 mb-5 rounded-caja bg-[#FDE9D8] px-3.5 py-3 text-[13px] leading-normal text-[#9A4A12]">
          {detalle.examenPreocupacional === "realizado"
            ? `${detalle.institucion.nombre} ya anotó que hiciste el examen preocupacional. Falta que te confirmen el ingreso.`
            : `Para ingresar a trabajar necesitás hacerte el examen preocupacional. Coordiná con ${detalle.institucion.nombre} cómo y dónde.`}
        </p>
      )}

      <section className="mb-5 rounded-interno border border-borde p-3.5">
        <div className={cn(ETIQUETA, "mb-2.5")}>Detalle del puesto</div>
        <div className="mb-2.5 flex flex-col gap-1.5 text-[13px] leading-[1.4] text-tinta-2">
          {detalle.zona && (
            <span className="flex items-center gap-2">
              <Icono nombre="ubicacion" tamano={14} trazo={2} className="text-apagado" />
              {detalle.zona}
            </span>
          )}
          {detalle.horario && (
            <span className="flex items-center gap-2">
              <Icono nombre="reloj" tamano={14} trazo={2} className="text-apagado" />
              {detalle.horario}
            </span>
          )}
          <span className="flex items-center gap-2">
            <Icono nombre="cursos" tamano={14} trazo={2} className="text-apagado" />
            {detalle.tipo}
          </span>
        </div>
        {detalle.descripcion && (
          <p className="m-0 text-[13px] leading-normal whitespace-pre-line text-tinta-2">{detalle.descripcion}</p>
        )}
        <Link href={`/docente/oferta/${detalle.busquedaId}`} className="mt-3 inline-block text-[13px] font-semibold">
          Ver la oferta completa
        </Link>
      </section>

      <div className={cn(ETIQUETA, "mb-2.5")}>Contacto</div>
      {detalle.invitada && detalle.contacto !== "cerrado" ? (
        // La institución la invitó pero ella todavía no aceptó: no ve su teléfono ni su email, así que no puede escribirle (aunque la
        // haya avanzado de etapa: hasta aceptar, la promesa de "te escribe por WhatsApp" no se cumple).
        <div className="rounded-caja bg-[#FDE9D8] p-3.5 text-[13px] leading-normal text-[#7A4A12]">
          {detalle.institucion.nombre} te invitó, pero todavía no ve tu teléfono ni tu email. Aceptá la invitación para postularte: así puede
          escribirte.
          <BotonLink variante="cta" bloque className="mt-3" href={`/docente/oferta/${detalle.busquedaId}`}>
            Aceptar la invitación
          </BotonLink>
        </div>
      ) : detalle.contacto === "activo" ? (
        <div className="flex items-start gap-3 rounded-caja border border-[#B9E3CE] bg-verde-tint p-3.5">
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="#1E7A4C" className="flex-none">
            <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5.1-1.3A10 10 0 1012 2zm5.6 14.3c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5.2.5.7 1.7.8 1.8.1.2.1.4 0 .6-.3.6-.6.8-.8 1.1-.2.2-.4.4-.2.8.6 1.1 1.3 1.8 2.2 2.4.9.6 1.4.8 1.7.6.3-.2.6-.6.9-.9.2-.3.5-.2.8-.1.3.1 1.7.8 2 .9.3.2.5.2.6.4.1.2.1.7-.2 1.4z" />
          </svg>
          <div className="text-[13px] leading-normal text-verde">
            La institución te contacta por WhatsApp al número que dejaste en tu perfil. UNIDOAR no tiene chat interno:
            toda la conversación con {detalle.institucion.nombre} sigue por ahí.
          </div>
        </div>
      ) : (
        <div className="text-[13px] leading-normal text-sutil">
          {detalle.contacto === "cerrado"
            ? "La institución no siguió adelante con esta postulación."
            : "Todavía no te contactaron por esta postulación. Si la institución avanza, te escribe por WhatsApp."}
        </div>
      )}
      <BotonLink variante="secundario" bloque className="mt-4" href={`/docente/instituciones/${detalle.institucion.slug}`}>
        Ir a institución
      </BotonLink>

      <section className="mt-[22px] border-t border-borde pt-[18px]">
        <div className={cn(ETIQUETA, "mb-2.5")}>Agendar</div>
        {detalle.agenda ? (
          <div className="mb-3 rounded-caja border border-[#B9E3CE] bg-verde-tint p-3.5">
            <div className="flex items-start gap-[9px]">
              <Icono nombre="calendario" tamano={16} trazo={1.8} className="mt-0.5 text-verde" />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-[13.5px] leading-[1.3] font-semibold text-verde">{detalle.agenda.titulo}</div>
                <div className="text-[12.5px] leading-[1.4] text-verde first-letter:uppercase">{detalle.agenda.cuando}</div>
                {detalle.agenda.deLaInstitucion && (
                  <div className="mt-1 text-[11.5px] leading-[1.4] text-verde">Entrevista agendada por la institución</div>
                )}
              </div>
            </div>
            {detalle.agenda.deLaInstitucion && detalle.respuestaEntrevista && (
              <RespuestaEntrevista postulacionId={detalle.id} datos={detalle.respuestaEntrevista} sugerida={respuestaSugerida} />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={detalle.agenda.googleHref}
                target="_blank"
                rel="noopener noreferrer"
                className={botonClases({ variante: "secundario", tamano: "sm", className: "flex-1 text-tinta hover:text-tinta" })}
              >
                Agregar a Google Calendar
              </a>
              {!detalle.agenda.deLaInstitucion && (
                <Boton
                  variante="secundario"
                  tamano="sm"
                  onClick={quitarAgenda}
                  disabled={pendiente}
                  className="border-[#F0C4BD] text-[#DC2626] hover:text-[#DC2626]"
                >
                  Quitar
                </Boton>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2.5 flex flex-wrap gap-2">
              <Input
                type="date"
                aria-label="Fecha"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="min-w-0 flex-[1_1_150px]"
              />
              <Input
                type="time"
                aria-label="Hora"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="min-w-0 flex-[1_1_110px]"
              />
            </div>
            <Input
              aria-label="Título del evento"
              placeholder="Ej. Entrevista con la directora"
              maxLength={120}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mb-2.5"
            />
            <Boton bloque onClick={agendar} disabled={!agendaCompleta || pendiente} className="bg-rosa hover:bg-[#7a0f4e]">
              Agendar
            </Boton>
            {error.agenda && (
              <p role="alert" className="mt-2 mb-0 text-xs text-[#b91c1c]">
                {error.agenda}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-[22px] border-t border-borde pt-[18px]">
        <div className={cn(ETIQUETA, "mb-1")}>Mis notas</div>
        <p className="m-0 mb-3 text-[12.5px] leading-[1.45] text-apagado">Privadas. La institución no las ve.</p>
        {detalle.notas.length > 0 && (
          <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0">
            {detalle.notas.map((n) => (
              <li key={n.id} className="rounded-caja border border-borde bg-superficie px-[13px] py-[11px]">
                <div className="flex items-start justify-between gap-2.5">
                  <span className="min-w-0 flex-1 text-[13px] leading-normal break-words whitespace-pre-line text-tinta-2">
                    {n.texto}
                  </span>
                  <button
                    type="button"
                    onClick={() => borrarNota(n.id)}
                    disabled={pendiente}
                    aria-label="Borrar nota"
                    className="flex-none rounded text-xs leading-none font-medium text-[#DC2626] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
                <div className="mt-1.5 text-[11.5px] leading-none text-sutil">{n.fecha}</div>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          aria-label="Nueva nota"
          placeholder="Ej. Pidieron que lleve el título original"
          maxLength={1000}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className="mb-2.5 min-h-[70px]"
        />
        <Boton variante="secundario" bloque onClick={guardarNota} disabled={nota.trim() === "" || pendiente}>
          Guardar nota
        </Boton>
        {error.nota && (
          <p role="alert" className="mt-2 mb-0 text-xs text-[#b91c1c]">
            {error.nota}
          </p>
        )}
      </section>

      {detalle.puedeRetirar && (
        <section className="mt-[22px] border-t border-borde pt-[18px]">
          {confirmandoRetiro ? (
            <div className="rounded-caja border border-[#F0C4BD] bg-[#FEF2F0] p-3.5">
              <p className="m-0 mb-3 text-[13px] leading-normal text-tinta-2">
                ¿Retirar tu postulación? Vamos a avisarle a {detalle.institucion.nombre} y se borran tus notas de esta
                postulación.
              </p>
              <div className="flex flex-wrap gap-2">
                <Boton variante="peligro" tamano="sm" onClick={retirar} disabled={pendiente}>
                  Sí, retirar
                </Boton>
                <Boton variante="secundario" tamano="sm" onClick={() => setConfirmandoRetiro(false)} disabled={pendiente}>
                  Cancelar
                </Boton>
              </div>
            </div>
          ) : (
            <Boton
              variante="secundario"
              bloque
              onClick={() => setConfirmandoRetiro(true)}
              className="border-[#F0C4BD] text-[#DC2626] hover:text-[#DC2626]"
            >
              Retirar postulación
            </Boton>
          )}
          {error.retiro && (
            <p role="alert" className="mt-2 mb-0 text-xs text-[#b91c1c]">
              {error.retiro}
            </p>
          )}
        </section>
      )}
    </Cajon>
  );
}
