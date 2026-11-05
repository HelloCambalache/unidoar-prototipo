"use client";

import { useActionState, useState, useTransition } from "react";
import { borrarContacto, guardarContacto, importarContactos } from "@/app/actions/contactos";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Textarea } from "@/components/ui/campos";
import { Icono } from "@/components/icons";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { useToast } from "@/components/ui/toast";
import type { Resultado } from "@/lib/acciones";
import { CARPETA_CV_CONTACTO, rutaDeCvDeContacto } from "@/lib/contacto-cv";
import {
  CSV_MODELO,
  MAX_BYTES_CSV,
  MAX_FILAS_IMPORTACION,
  filasDeCsv,
  validarFilas,
  type FilaCruda,
  type ValidacionDeFilas,
} from "@/lib/contactos";
import { enlaceWhatsapp } from "@/lib/pipeline";
import type { ContactoVista } from "@/lib/queries/profesionales";

/*
 * Contactos privados de la institución (Profesionales): los botones de arriba ("Cargar perfil" e "Importar CSV")
 * y las acciones de cada fila cargada (WhatsApp, editar, borrar). Los datos se validan igual en el servidor.
 */

const AYUDA_CSV =
  "Tiene que traer los títulos en la primera fila: nombre, email, teléfono, disciplina y nota. Alcanza con nombre y un email o un teléfono por fila.";

/* ───────────────────────────── CV adjunto ───────────────────────────── */

/** Lo que la persona hizo con el CV en este formulario: lo dejó como estaba, lo quitó o subió uno nuevo. Viaja al servidor como `cvAccion`. */
type CambioDeCvEnFormulario = { tipo: "igual" } | { tipo: "quitar" } | { tipo: "nuevo"; path: string; nombre: string };

/**
 * El CV del contacto (un PDF, opcional). El archivo se sube apenas se elige (por la subida de siempre, al espacio privado) y recién queda
 * guardado en el contacto al apretar «Guardar»: si se cancela, no se pierde nada del contacto. La pantalla nunca tiene el path del archivo
 * que ya estaba guardado, solo su nombre: «Ver» lo abre por un enlace que comprueba la cuenta.
 */
function CampoCv({ contacto, cambio, onCambio }: { contacto?: ContactoVista; cambio: CambioDeCvEnFormulario; onCambio: (c: CambioDeCvEnFormulario) => void }) {
  // Cada subida reinicia el botón (si no, se quedaría marcado como «✓» y no se vería que se puede reemplazar de nuevo).
  const [subidas, setSubidas] = useState(0);
  const nombreActual = cambio.tipo === "nuevo" ? cambio.nombre : cambio.tipo === "igual" ? (contacto?.cvNombre ?? null) : null;
  const guardado = cambio.tipo === "igual" && contacto?.cvNombre ? rutaDeCvDeContacto(contacto.id) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="cvAccion" value={cambio.tipo} />
      {cambio.tipo === "nuevo" && (
        <>
          <input type="hidden" name="cvPath" value={cambio.path} />
          <input type="hidden" name="cvNombre" value={cambio.nombre} />
        </>
      )}
      <span className="text-xs font-semibold text-apagado">CV (opcional)</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {nombreActual && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[13px] font-medium text-tinta">
            <Icono nombre="archivo" tamano={15} trazo={1.6} className="flex-none text-apagado" />
            <span className="truncate">{nombreActual}</span>
            {cambio.tipo === "nuevo" && <span className="flex-none text-xs font-normal text-sutil">(se guarda al apretar Guardar)</span>}
          </span>
        )}
        {guardado && (
          <a href={guardado} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-navy-700 underline">
            Ver
          </a>
        )}
        <SubirArchivo
          key={subidas}
          bucket="privado"
          carpeta={CARPETA_CV_CONTACTO}
          nombre="cvArchivo"
          etiqueta="CV del contacto"
          variante="boton"
          textoBoton={nombreActual ? "Reemplazar" : "Adjuntar CV"}
          onCambio={(path, nombre) => {
            if (!path) return;
            onCambio({ tipo: "nuevo", path, nombre: nombre ?? "" });
            setSubidas((n) => n + 1);
          }}
        />
        {nombreActual && (
          <Boton variante="fantasma" tamano="sm" className="text-[#b91c1c] hover:text-[#b91c1c]" onClick={() => onCambio({ tipo: "quitar" })}>
            Quitar
          </Boton>
        )}
      </div>
      <p className="m-0 text-xs leading-snug text-sutil">
        {cambio.tipo === "quitar" && contacto?.cvNombre
          ? "Se quita el CV al apretar Guardar."
          : "Un PDF por contacto. Queda en un espacio privado y solo lo ve tu institución."}
      </p>
    </div>
  );
}

/* ───────────────────────────── Formulario (crear y editar) ───────────────────────────── */

function ContactoFormulario({ contacto, onCerrar }: { contacto?: ContactoVista; onCerrar: () => void }) {
  const toast = useToast();
  const [cv, setCv] = useState<CambioDeCvEnFormulario>({ tipo: "igual" });
  const [valores, setValores] = useState({
    nombre: contacto?.nombre ?? "",
    email: contacto?.email ?? "",
    telefono: contacto?.telefono ?? "",
    disciplina: contacto?.disciplina ?? "",
    nota: contacto?.nota ?? "",
  });
  const [estado, accion, pendiente] = useActionState(
    async (previo: Resultado<{ id: string }> | null, formData: FormData) => {
      const r = await guardarContacto(previo, formData);
      if (r.ok) {
        toast(contacto ? "Contacto actualizado" : "Contacto guardado");
        onCerrar();
      }
      return r;
    },
    null,
  );
  const errores = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const errorGeneral = estado && !estado.ok && Object.keys(errores).length === 0 ? estado.error : null;
  const poner = (campo: keyof typeof valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValores((v) => ({ ...v, [campo]: e.target.value }));

  return (
    <form action={accion} noValidate className="mt-3 flex flex-col gap-3.5">
      {contacto && <input type="hidden" name="id" value={contacto.id} />}
      <Campo etiqueta="Nombre y apellido" requerido error={errores.nombre}>
        <Input name="nombre" value={valores.nombre} onChange={poner("nombre")} maxLength={120} autoFocus aria-invalid={Boolean(errores.nombre)} />
      </Campo>
      <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <Campo etiqueta="Email" error={errores.email}>
          <Input type="email" name="email" value={valores.email} onChange={poner("email")} maxLength={200} autoComplete="off" aria-invalid={Boolean(errores.email)} />
        </Campo>
        <Campo etiqueta="Teléfono o WhatsApp" error={errores.telefono}>
          <Input type="tel" name="telefono" value={valores.telefono} onChange={poner("telefono")} maxLength={40} autoComplete="off" aria-invalid={Boolean(errores.telefono)} />
        </Campo>
      </div>
      {!errores.email && !errores.telefono && (
        <p className="m-0 -mt-1.5 text-xs text-sutil">Dejá al menos uno de los dos para poder contactarlo.</p>
      )}
      <Campo etiqueta="Disciplina" error={errores.disciplina}>
        <Input name="disciplina" value={valores.disciplina} onChange={poner("disciplina")} maxLength={100} placeholder="Educación Física, Natación…" aria-invalid={Boolean(errores.disciplina)} />
      </Campo>
      <Campo etiqueta="Nota" ayuda="Solo la ves vos y tu equipo." error={errores.nota}>
        <Textarea name="nota" value={valores.nota} onChange={poner("nota")} maxLength={500} aria-invalid={Boolean(errores.nota)} />
      </Campo>
      <CampoCv contacto={contacto} cambio={cv} onCambio={setCv} />
      {errorGeneral && (
        <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
          {errorGeneral}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        <Boton variante="secundario" onClick={onCerrar} disabled={pendiente}>
          Cancelar
        </Boton>
        <Boton type="submit" variante="primario" disabled={pendiente}>
          {pendiente ? "Guardando…" : contacto ? "Guardar cambios" : "Guardar contacto"}
        </Boton>
      </div>
    </form>
  );
}

/* ───────────────────────────── Importar CSV ───────────────────────────── */

/** Excel en español guarda los CSV en Windows-1252: si no es UTF-8 válido, se lee así para no romper las tildes. */
async function leerTexto(archivo: File) {
  const bytes = await archivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function descargarModelo() {
  const enlace = document.createElement("a");
  const blob = new Blob(["﻿", CSV_MODELO], { type: "text/csv;charset=utf-8" });
  enlace.href = URL.createObjectURL(blob);
  enlace.download = "modelo-contactos.csv";
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function ImportarFormulario({ onCerrar }: { onCerrar: () => void }) {
  const toast = useToast();
  const [lectura, setLectura] = useState<{ filas: FilaCruda[]; validacion: ValidacionDeFilas } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    setLectura(null);
    setError(null);
    if (!archivo) return;
    if (archivo.size > MAX_BYTES_CSV) {
      setError(`El archivo pesa más de ${MAX_BYTES_CSV / 1024} KB: partilo en varios.`);
      return;
    }
    try {
      const r = filasDeCsv(await leerTexto(archivo));
      if (r.error) return setError(r.error);
      if (r.filas.length === 0) return setError("No encontramos filas con datos debajo de los títulos.");
      if (r.filas.length > MAX_FILAS_IMPORTACION) {
        return setError(`El archivo tiene ${r.filas.length} filas y el máximo es ${MAX_FILAS_IMPORTACION} por vez: partilo en varios.`);
      }
      setLectura({ filas: r.filas, validacion: validarFilas(r.filas) });
    } catch {
      setError("No pudimos leer el archivo. Probá guardarlo de nuevo como CSV.");
    }
  };

  const importar = () => {
    if (!lectura) return;
    empezar(async () => {
      try {
        const r = await importarContactos(lectura.filas);
        if (!r.ok) return setError(r.error);
        const { creados, yaEstaban, conError } = r.data;
        const partes = [`Importamos ${plural(creados, "contacto", "contactos")}`];
        if (yaEstaban > 0) partes.push(`${yaEstaban} ya estaban`);
        if (conError > 0) partes.push(`${conError} con errores`);
        toast(partes.join(" · "));
        onCerrar();
      } catch {
        setError("No pudimos importar el archivo. Probá de nuevo.");
      }
    });
  };

  const v = lectura?.validacion;
  return (
    <div className="mt-3 flex flex-col gap-3.5">
      <p className="m-0 text-[13.5px] leading-normal text-apagado">
        {AYUDA_CSV} Hasta {MAX_FILAS_IMPORTACION} filas por archivo.{" "}
        <button type="button" onClick={descargarModelo} className="cursor-pointer border-0 bg-transparent p-0 font-medium text-navy-700 underline">
          Descargar un modelo
        </button>
      </p>
      <Campo etiqueta="Archivo CSV">
        <Input type="file" accept=".csv,text/csv" onChange={alElegir} disabled={pendiente} />
      </Campo>

      {error && (
        <p role="alert" className="m-0 rounded-caja bg-rosa-tint px-3.5 py-3 text-[13px] leading-normal text-rosa">
          {error}
        </p>
      )}

      {v && (
        <div className="flex flex-col gap-3 rounded-caja border border-borde bg-superficie px-3.5 py-3 text-[13px] leading-normal">
          <p className="m-0 font-semibold text-tinta">
            {plural(v.validas.length, "contacto listo", "contactos listos")} para importar
            {v.errores.length > 0 && <span className="font-normal text-apagado"> · {plural(v.errores.length, "fila con error", "filas con errores")} (se saltean)</span>}
            {v.repetidasEnArchivo > 0 && (
              <span className="font-normal text-apagado"> · {plural(v.repetidasEnArchivo, "repetida", "repetidas")} en el archivo</span>
            )}
          </p>
          {v.validas.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-tinta-2">
              {v.validas.slice(0, 5).map((c) => (
                <li key={c.linea} className="truncate">
                  <b className="font-semibold">{c.nombre}</b>
                  <span className="text-apagado"> · {[c.email, c.telefono, c.disciplina].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
              {v.validas.length > 5 && <li className="text-apagado">y {v.validas.length - 5} más</li>}
            </ul>
          )}
          {v.errores.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 border-t border-borde p-0 pt-2.5 text-[#b91c1c]">
              {v.errores.slice(0, 6).map((f) => (
                <li key={f.linea}>
                  Fila {f.linea} ({f.nombre}): {f.mensaje}
                </li>
              ))}
              {v.errores.length > 6 && <li>y {v.errores.length - 6} más</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2.5">
        <Boton variante="secundario" onClick={onCerrar} disabled={pendiente}>
          Cancelar
        </Boton>
        <Boton variante="primario" onClick={importar} disabled={pendiente || !v || v.validas.length === 0}>
          {pendiente ? "Importando…" : v && v.validas.length > 0 ? `Importar ${plural(v.validas.length, "contacto", "contactos")}` : "Importar"}
        </Boton>
      </div>
    </div>
  );
}

/* ───────────────────────────── Botones del encabezado ───────────────────────────── */

export function AccionesContactos() {
  const [abierto, setAbierto] = useState<"cargar" | "importar" | null>(null);
  const cerrar = () => setAbierto(null);
  return (
    <>
      <Boton variante="secundario" className="border-navy-700 text-navy-700" onClick={() => setAbierto("importar")}>
        Importar CSV
      </Boton>
      <Boton onClick={() => setAbierto("cargar")}>+ Cargar perfil</Boton>
      <DialogoModal abierto={abierto === "cargar"} onCerrar={cerrar} titulo="Cargar perfil" ancho={520}>
        <p className="m-0 text-[13.5px] leading-normal text-apagado">
          Sumá a alguien que ya conocés, con su CV si lo tenés. Queda en tu lista de Profesionales y solo lo ve tu institución: no es un perfil de UNIDOAR.
        </p>
        <ContactoFormulario onCerrar={cerrar} />
      </DialogoModal>
      <DialogoModal abierto={abierto === "importar"} onCerrar={cerrar} titulo="Importar profesionales desde un CSV" ancho={560}>
        <ImportarFormulario onCerrar={cerrar} />
      </DialogoModal>
    </>
  );
}

/* ───────────────────────────── Acciones de una fila ───────────────────────────── */

export function AccionesContacto({ contacto }: { contacto: ContactoVista }) {
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [editando, setEditando] = useState(false);
  const [pendiente, empezar] = useTransition();
  const whatsapp = enlaceWhatsapp(contacto.telefono);

  const borrar = async () => {
    if (!(await pedirConfirmacion(`¿Borrar a ${contacto.nombre} de tus contactos? Esto no se puede deshacer.`))) return;
    empezar(async () => {
      try {
        const r = await borrarContacto(contacto.id);
        if (!r.ok) toast(r.error, "error");
        else toast("Contacto borrado");
      } catch {
        toast("No pudimos borrar el contacto. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {contacto.cvNombre && (
        <a
          href={rutaDeCvDeContacto(contacto.id)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Abrir el CV: ${contacto.cvNombre}`}
          className="px-2 text-[13px] leading-none font-medium whitespace-nowrap text-navy-700"
        >
          Ver CV
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 text-[13px] leading-none font-medium whitespace-nowrap text-navy-700"
        >
          WhatsApp
        </a>
      )}
      <Boton variante="fantasma" tamano="sm" onClick={() => setEditando(true)}>
        Editar
      </Boton>
      <Boton variante="fantasma" tamano="sm" className="text-[#b91c1c] hover:text-[#b91c1c]" onClick={borrar} disabled={pendiente}>
        Borrar
      </Boton>
      <DialogoModal abierto={editando} onCerrar={() => setEditando(false)} titulo="Editar contacto" ancho={520}>
        <ContactoFormulario contacto={contacto} onCerrar={() => setEditando(false)} />
      </DialogoModal>
    </div>
  );
}
