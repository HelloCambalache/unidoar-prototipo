"use client";

import { useActionState, useState, useTransition } from "react";
import { cambiarRolMiembro, invitarMiembro, quitarMiembro } from "@/app/actions/equipo";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { ROLES_EQUIPO_INFO, ROLES_INVITABLES } from "@/lib/catalogo";
import { infoDeRol, type MiembroVista } from "@/lib/equipo";
import { cn } from "@/lib/utils";

const NOTA_SIN_MAIL =
  "Todavía no mandamos mails: al crear la invitación te damos un enlace para que se lo pases. La persona tiene que registrarse como institución con ese mismo email.";

/** Caja gris con texto chico (descripción del rol, avisos). */
const CAJA = "rounded-lg border border-borde bg-superficie px-3.5 py-3 text-[12.5px] leading-normal text-apagado";

/** Enlace de registro para copiar, con los pasos que tiene que seguir la persona invitada. */
function EnlaceInvitacion({ url, email }: { url: string; email: string }) {
  const toast = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado");
    } catch {
      toast("No pudimos copiarlo: seleccionalo y copialo a mano.", "error");
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 max-[560px]:flex-col">
        <Input
          readOnly
          value={url}
          aria-label="Enlace de registro"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1"
        />
        <Boton variante="secundario" onClick={copiar} className="flex-none">
          Copiar enlace
        </Boton>
      </div>
      <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-[18px] text-[13px] leading-normal text-tinta-2">
        <li>Pasale este enlace a la persona.</li>
        <li>
          Tiene que elegir «Soy institución» y registrarse con <strong className="text-tinta">este mismo email: {email}</strong>.
        </li>
        <li>Cuando entre, queda unida a tu institución y te avisamos acá.</li>
      </ol>
    </div>
  );
}

function FormularioInvitar({ urlRegistro, onCerrar }: { urlRegistro: string; onCerrar: () => void }) {
  const [estado, accion, pendiente] = useActionState(invitarMiembro, null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<(typeof ROLES_INVITABLES)[number]>("administrador");
  const errores = estado && !estado.ok ? (estado.campos ?? {}) : {};

  if (estado?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-normal text-tinta-2">
          Listo: invitaste a <strong className="text-tinta">{estado.data.email}</strong> como{" "}
          <strong className="text-tinta">{infoDeRol(estado.data.rol).label}</strong>. Quedó en la tabla con la invitación pendiente.
        </p>
        <EnlaceInvitacion url={urlRegistro} email={estado.data.email} />
        <Boton onClick={onCerrar} variante="primario" className="self-start">
          Listo
        </Boton>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-3.5">
      <Campo etiqueta="Email" error={errores.email}>
        <Input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@colegio.edu.ar"
          autoComplete="off"
          autoFocus
          required
          aria-invalid={Boolean(errores.email)}
        />
      </Campo>
      <Campo etiqueta="Rol" error={errores.rol}>
        <Select name="rol" value={rol} onChange={(e) => setRol(e.target.value as typeof rol)}>
          {ROLES_INVITABLES.map((r) => (
            <option key={r} value={r}>
              {ROLES_EQUIPO_INFO[r].label}
            </option>
          ))}
        </Select>
      </Campo>
      <div className={CAJA}>{ROLES_EQUIPO_INFO[rol].desc}</div>
      <p className="m-0 text-[12.5px] leading-normal text-apagado">{NOTA_SIN_MAIL}</p>
      {estado && !estado.ok && Object.keys(errores).length === 0 && (
        <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
          {estado.error}
        </p>
      )}
      <div className="mt-1 flex gap-2.5 max-[560px]:flex-col">
        <Boton type="submit" variante="cta" tamano="lg" disabled={pendiente} aria-busy={pendiente}>
          {pendiente ? "Creando…" : "Crear invitación"}
        </Boton>
        <Boton variante="secundario" tamano="lg" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

function BotonEliminar({ miembro }: { miembro: MiembroVista }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const invitado = miembro.estado === "invitado";
  const quitar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pregunta = invitado
      ? `¿Cancelar la invitación a ${miembro.email}?`
      : `¿Quitar a ${miembro.nombre} del equipo? Va a perder el acceso a la cuenta de la institución.`;
    if (!window.confirm(pregunta)) return;
    empezar(async () => {
      try {
        const r = await quitarMiembro(miembro.id);
        if (r.ok) toast(invitado ? "Invitación cancelada" : "Persona eliminada del equipo");
        else toast(r.error, "error");
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };
  return (
    <button
      type="button"
      onClick={quitar}
      disabled={pendiente}
      aria-label={`${invitado ? "Cancelar la invitación a" : "Eliminar a"} ${miembro.nombre}`}
      className="rounded text-xs leading-none font-medium text-sutil transition-colors hover:text-[#dc2626] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:opacity-50"
    >
      {pendiente ? "Eliminando…" : "Eliminar"}
    </button>
  );
}

function Ficha({
  miembro,
  puedeGestionar,
  urlRegistro,
  onCerrar,
}: {
  miembro: MiembroVista;
  puedeGestionar: boolean;
  urlRegistro: string;
  onCerrar: () => void;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  // Se remonta el selector si el servidor rechaza el cambio, para que vuelva al rol que sigue vigente.
  const [version, setVersion] = useState(0);
  const info = infoDeRol(miembro.rol);
  const invitado = miembro.estado === "invitado";
  const editable = puedeGestionar && !miembro.esDueno;
  const roles: string[] = [...ROLES_INVITABLES];
  if (!roles.includes(miembro.rol)) roles.push(miembro.rol);

  const cambiarRol = (rol: string) => {
    empezar(async () => {
      try {
        const r = await cambiarRolMiembro(miembro.id, rol);
        if (r.ok) toast("Rol actualizado");
        else {
          toast(r.error, "error");
          setVersion((v) => v + 1);
        }
      } catch {
        toast("No pudimos cambiar el rol. Probá de nuevo.", "error");
        setVersion((v) => v + 1);
      }
    });
  };

  return (
    <Tarjeta como="section" aria-label={`Ficha de ${miembro.nombre}`} className="relative mb-5 max-w-[680px] p-[22px]">
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar ficha"
        className="absolute top-4 right-4 rounded p-1 text-sutil hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <span aria-hidden>✕</span>
      </button>
      <div className="mb-4 flex items-center gap-3.5 pr-8">
        <Avatar iniciales={miembro.iniciales} tamano={48} />
        <div className="min-w-0">
          <div className="truncate text-[17px] leading-tight font-semibold">{miembro.nombre}</div>
          <Insignia tono={miembro.esDueno ? "azul" : "neutro"} className="mt-1">
            {info.label}
          </Insignia>
        </div>
      </div>
      <dl className="m-0 flex flex-col gap-2 text-sm leading-normal text-tinta-2">
        <div>
          <dt className="inline font-semibold text-tinta">Email: </dt>
          <dd className="m-0 inline break-all">{miembro.email}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-tinta">Estado: </dt>
          <dd className="m-0 inline">{invitado ? "Invitación pendiente: todavía no se registró" : "Activo"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-tinta">{invitado ? "Invitado en: " : "Miembro desde: "}</dt>
          <dd className="m-0 inline">{miembro.desde}</dd>
        </div>
      </dl>

      {info.desc && <div className={cn(CAJA, "mt-4")}>{info.desc}</div>}

      {editable && (
        <div className="mt-4 max-w-[320px]">
          <Campo etiqueta="Rol">
            <Select
              key={`${miembro.id}-${miembro.rol}-${version}`}
              defaultValue={miembro.rol}
              disabled={pendiente}
              onChange={(e) => cambiarRol(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {infoDeRol(r).label}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      )}

      {invitado && (
        <div className="mt-4 border-t border-borde pt-4">
          <div className="mb-2.5 text-[13px] font-semibold text-tinta">Cómo se suma</div>
          <EnlaceInvitacion url={urlRegistro} email={miembro.email} />
        </div>
      )}
    </Tarjeta>
  );
}

/**
 * Pantalla "Equipo": tabla de personas, ficha de la seleccionada y modal para invitar. Invitar, cambiar el rol y
 * quitar se muestran solo a quienes pueden (dueño y administradores); el servidor lo vuelve a verificar.
 */
export function EquipoPanel({
  miembros,
  puedeGestionar,
  urlRegistro,
}: {
  miembros: MiembroVista[];
  puedeGestionar: boolean;
  urlRegistro: string;
}) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);
  // Si la persona se eliminó mientras estaba abierta su ficha, deja de encontrarse y la ficha se cierra sola.
  const seleccionado = miembros.find((m) => m.id === seleccionadoId) ?? null;

  return (
    <>
      <EncabezadoPagina
        titulo="Equipo"
        bajada="Sumá a quien participa de las contrataciones."
        acciones={
          puedeGestionar ? (
            <Boton variante="cta" tamano="lg" onClick={() => setInvitando(true)}>
              Invitar a alguien
            </Boton>
          ) : undefined
        }
      />

      <DialogoModal abierto={invitando} onCerrar={() => setInvitando(false)} titulo="Invitar a alguien" ancho={480}>
        <div className="mt-4">
          <FormularioInvitar urlRegistro={urlRegistro} onCerrar={() => setInvitando(false)} />
        </div>
      </DialogoModal>

      {seleccionado && (
        <Ficha
          miembro={seleccionado}
          puedeGestionar={puedeGestionar}
          urlRegistro={urlRegistro}
          onCerrar={() => setSeleccionadoId(null)}
        />
      )}

      <Tabla>
        <thead>
          <tr>
            <th>Persona</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {miembros.map((m) => (
            <tr
              key={m.id}
              onClick={() => setSeleccionadoId(m.id)}
              aria-selected={m.id === seleccionadoId}
              className={cn("cursor-pointer", m.id === seleccionadoId && "bg-superficie")}
            >
              <td>
                <div className="flex items-center gap-[11px]">
                  <Avatar iniciales={m.iniciales} tamano={32} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeleccionadoId(m.id);
                    }}
                    aria-label={`Ver ficha de ${m.nombre}`}
                    className="rounded text-left font-semibold focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
                  >
                    {m.nombre}
                  </button>
                  {m.esYo && <span className="text-xs text-sutil">(vos)</span>}
                </div>
              </td>
              <td>
                <Insignia tono={m.esDueno ? "azul" : "neutro"}>{infoDeRol(m.rol).label}</Insignia>
              </td>
              <td>
                <Insignia tono={m.estado === "activo" ? "verde" : "ambar"}>
                  {m.estado === "activo" ? "Activo" : "Invitación enviada"}
                </Insignia>
              </td>
              <td className="text-right">
                {puedeGestionar && !m.esDueno && !m.esYo && <BotonEliminar miembro={m} />}
              </td>
            </tr>
          ))}
        </tbody>
      </Tabla>

      {miembros.length <= 1 && (
        <p className="mt-3.5 mb-0 text-[13px] leading-normal text-apagado">
          Todavía no sumaste a nadie más.
          {puedeGestionar ? " Invitá a quien participe de las contrataciones y elegí qué rol tiene." : ""}
        </p>
      )}
      {!puedeGestionar && (
        <p className="mt-3.5 mb-0 text-[13px] leading-normal text-apagado">
          Solo el dueño y los administradores pueden invitar, cambiar roles o quitar personas del equipo.
        </p>
      )}
    </>
  );
}
