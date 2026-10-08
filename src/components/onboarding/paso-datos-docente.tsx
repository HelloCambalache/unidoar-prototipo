"use client";

import { useActionState, useState } from "react";
import { guardarDatosDocente } from "@/app/actions/onboarding";
import { CampoDireccion } from "@/components/ui/campo-direccion";
import { Campo, Input } from "@/components/ui/campos";
import { BotonEnvio } from "@/components/onboarding/boton-envio";
import { Boton } from "@/components/ui/button";
import { AlertaAviso, AlertaError, EnlaceVolver } from "@/components/onboarding/elementos";
import { SelectorZonas } from "@/components/onboarding/selector-zonas";
import { ID_FORMULARIO_ONBOARDING, valorDe, type DatosForm } from "@/lib/onboarding";

/** Cuántos de los 8 bloques de datos están completos (nombre y apellido cuentan como uno). */
function contarCompletos(v: (campo: string) => string) {
  const llenos = [
    v("nombre") && v("apellido"),
    v("fechaNacimiento"),
    v("dni"),
    v("telefono"),
    v("cuil"),
    v("direccion"),
    v("partido"),
    v("provincia"),
  ];
  return llenos.filter((x) => Boolean(x?.trim())).length;
}

/**
 * "Tu perfil": datos personales y zonas. Nombre, apellido, DNI y teléfono (con *) se exigen al continuar;
 * "Guardar borrador" guarda lo que haya sin exigirlos. El DNI y demás datos personales son privados:
 * se guardan aparte de los datos públicos del perfil.
 */
export function PasoDatosDocente({
  inicial,
  zonasIniciales,
  zonasSugeridas,
  partidos,
  provincias,
}: {
  inicial: DatosForm;
  zonasIniciales: string[];
  zonasSugeridas: string[];
  partidos: string[];
  provincias: string[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarDatosDocente, null);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const v = (campo: string) => valorDe(estado, inicial, campo);
  const [completos, setCompletos] = useState(() => contarCompletos((c) => inicial[c] ?? ""));

  const alEscribir = (e: React.FormEvent<HTMLFormElement>) => {
    const datos = new FormData(e.currentTarget);
    setCompletos(contarCompletos((c) => String(datos.get(c) ?? "")));
  };

  const zonasEnviadas = estado?.valores?.zonas;
  const zonas = Array.isArray(zonasEnviadas) ? zonasEnviadas : typeof zonasEnviadas === "string" && zonasEnviadas ? [zonasEnviadas] : zonasIniciales;

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion} onInput={alEscribir}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <div className="mb-1.5 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-1.5">
        <h1 className="m-0 text-2xl leading-tight font-semibold tracking-[-0.018em]">Tus datos personales</h1>
        <span aria-live="polite" className="text-xs leading-none font-medium text-verde">
          {completos} de 8 campos completos
        </span>
      </div>
      <p className="m-0 mb-5 text-sm leading-normal text-apagado">
        Completá tus datos. Los campos con * son obligatorios para que podamos verificarte.
      </p>

      <fieldset className="m-0 mb-4 min-w-0 rounded-lg border border-borde p-[18px]">
        <legend className="px-0 text-[13px] leading-none font-semibold">Datos personales</legend>
        <div className="mt-3.5 flex flex-col gap-3">
          <div className="flex gap-3.5 max-[640px]:flex-col">
            <Campo etiqueta="Nombre" requerido className="flex-1" error={campos.nombre}>
              <Input name="nombre" autoComplete="given-name" defaultValue={v("nombre")} aria-invalid={Boolean(campos.nombre)} />
            </Campo>
            <Campo etiqueta="Apellido" requerido className="flex-1" error={campos.apellido}>
              <Input name="apellido" autoComplete="family-name" defaultValue={v("apellido")} aria-invalid={Boolean(campos.apellido)} />
            </Campo>
          </div>
          <div className="flex gap-3.5 max-[640px]:flex-col">
            <Campo etiqueta="Fecha de nacimiento" className="flex-1" error={campos.fechaNacimiento}>
              <Input name="fechaNacimiento" type="date" autoComplete="bday" defaultValue={v("fechaNacimiento")} aria-invalid={Boolean(campos.fechaNacimiento)} />
            </Campo>
            <Campo etiqueta="DNI" requerido className="flex-1" error={campos.dni}>
              <Input
                name="dni"
                inputMode="numeric"
                placeholder="Sin completar — lo necesitamos para verificarte"
                defaultValue={v("dni")}
                aria-invalid={Boolean(campos.dni)}
              />
            </Campo>
          </div>
          <div className="flex gap-3.5 max-[640px]:flex-col">
            <Campo etiqueta="Teléfono / WhatsApp" requerido className="flex-1" error={campos.telefono}>
              <Input name="telefono" type="tel" autoComplete="tel" placeholder="Ej. 11 5847-2210" defaultValue={v("telefono")} aria-invalid={Boolean(campos.telefono)} />
            </Campo>
            <Campo etiqueta="CUIL" className="flex-1" error={campos.cuil}>
              <Input name="cuil" inputMode="numeric" placeholder="Ej. 27-30123456-4" defaultValue={v("cuil")} aria-invalid={Boolean(campos.cuil)} />
            </Campo>
          </div>
          {/* El domicilio es privado: se consulta solo en Georef y solo sirve para completar el partido y la provincia. */}
          <CampoDireccion
            proposito="docente"
            defaultValue={v("direccion")}
            campoPartido="partido"
            campoProvincia="provincia"
            enviarFirma={false}
            ayuda="Escribí calle, número y localidad: completamos el partido y la provincia."
            error={campos.direccion}
          />
          <div className="flex gap-3.5 max-[640px]:flex-col">
            <Campo etiqueta="Partido" className="flex-1" error={campos.partido}>
              <Input name="partido" list="docente-partidos" placeholder="Ej. Vicente López" defaultValue={v("partido")} aria-invalid={Boolean(campos.partido)} />
            </Campo>
            <Campo etiqueta="Provincia" className="flex-1" error={campos.provincia}>
              <Input name="provincia" list="docente-provincias" placeholder="Ej. Buenos Aires" defaultValue={v("provincia")} aria-invalid={Boolean(campos.provincia)} />
            </Campo>
          </div>
        </div>
        <datalist id="docente-partidos">
          {partidos.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="docente-provincias">
          {provincias.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </fieldset>

      <fieldset className="m-0 mb-4 min-w-0 rounded-lg border border-borde p-[18px]">
        <legend className="px-0 text-[13px] leading-none font-semibold">Dónde trabajás</legend>
        <p className="mt-2.5 mb-3.5 text-[13px] leading-normal text-apagado">
          Con las zonas calculamos a cuántos kilómetros estás de cada institución.
        </p>
        <SelectorZonas sugerencias={zonasSugeridas} inicial={zonas} error={campos.zonas} />
      </fieldset>

      <div className="mb-3.5 flex flex-col gap-2.5">
        <AlertaError>{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
        <AlertaAviso>{estado?.ok ? estado.mensaje : undefined}</AlertaAviso>
      </div>
      <div className="flex items-center justify-between gap-3 max-[640px]:flex-col-reverse max-[640px]:items-stretch">
        <EnlaceVolver href="/onboarding/docente/categoria" />
        <div className="flex gap-2.5 max-[640px]:flex-col">
          <BotonEnvio campo="destino" valor="borrador" variante="secundario" disabled={pendiente}>
            Guardar borrador
          </BotonEnvio>
          <Boton type="submit" variante="cta" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Continuar"}
          </Boton>
        </div>
      </div>
    </form>
  );
}
