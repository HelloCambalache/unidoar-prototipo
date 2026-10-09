"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearInstitucion } from "@/app/actions/onboarding";
import { Boton } from "@/components/ui/button";
import { CampoDireccion } from "@/components/ui/campo-direccion";
import { Campo, Casilla, Input, Select } from "@/components/ui/campos";
import { AlertaError, TituloPaso } from "@/components/onboarding/elementos";
import { ROLES_CONTACTO, TIPOS_CON_CUE, TIPOS_INSTITUCION } from "@/lib/catalogo";
import { ID_FORMULARIO_ONBOARDING, valorDe, type DatosForm } from "@/lib/onboarding";

/**
 * Paso 2 de la institución. Si ya la había creado, llega precargado y guardar actualiza (no duplica).
 * El código CUE solo aparece para los tipos que son establecimientos educativos.
 */
export function FormularioInstitucion({
  inicial,
  yaCreada,
  pedirTerminos,
  partidos,
  provincias,
}: {
  inicial: DatosForm;
  yaCreada: boolean;
  /** La cuenta no tiene la constancia de los términos (se creó antes de que se aceptaran en el paso 1): se piden acá. */
  pedirTerminos: boolean;
  partidos: string[];
  provincias: string[];
}) {
  const [estado, accion, pendiente] = useActionState(crearInstitucion, null);
  const [tipo, setTipo] = useState<string>(inicial.tipo || TIPOS_INSTITUCION[0]);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const v = (campo: string) => valorDe(estado, inicial, campo);
  const conCue = TIPOS_CON_CUE.includes(tipo);
  const id = (c: string) => `inst-${c}`;

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <TituloPaso
        titulo="Contanos sobre tu institución"
        bajada="Con esto armamos tu vitrina y filtramos los perfiles que te sirven."
      />
      <div className="flex flex-col gap-3.5">
        <Campo etiqueta="Nombre de la institución" error={campos.nombre}>
          <Input name="nombre" placeholder="Ej. Colegio San Andrés del Norte" required defaultValue={v("nombre")} aria-invalid={Boolean(campos.nombre)} />
        </Campo>

        <div className="flex gap-3.5 max-[640px]:flex-col">
          <Campo etiqueta="Tipo de institución" className="flex-1" error={campos.tipo}>
            <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-invalid={Boolean(campos.tipo)}>
              {TIPOS_INSTITUCION.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Año de fundación" className="flex-1" error={campos.fundada}>
            <Input
              name="fundada"
              type="number"
              inputMode="numeric"
              min={1800}
              max={new Date().getFullYear()}
              placeholder="Ej. 1978"
              defaultValue={v("fundada")}
              aria-invalid={Boolean(campos.fundada)}
            />
          </Campo>
        </div>

        <Campo etiqueta="Nombre de contacto" error={campos.contactoNombre}>
          <Input name="contactoNombre" autoComplete="name" placeholder="Ej. Marina Gómez" required defaultValue={v("contactoNombre")} aria-invalid={Boolean(campos.contactoNombre)} />
        </Campo>

        <div className="flex gap-3.5 max-[640px]:flex-col">
          <Campo etiqueta="Rol en la institución" className="flex-1" error={campos.contactoRol}>
            <Select name="contactoRol" defaultValue={v("contactoRol") || ROLES_CONTACTO[0]} aria-invalid={Boolean(campos.contactoRol)}>
              {ROLES_CONTACTO.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Teléfono" className="flex-1" error={campos.telefono}>
            <Input name="telefono" type="tel" autoComplete="tel" placeholder="11 5555 5555" required defaultValue={v("telefono")} aria-invalid={Boolean(campos.telefono)} />
          </Campo>
        </div>

        <div className="flex gap-3.5 max-[640px]:flex-col">
          <Campo etiqueta="CUIT / CUIL de la institución" className="flex-1" error={campos.cuit}>
            <Input name="cuit" placeholder="Ej. 30-12345678-9" defaultValue={v("cuit")} aria-invalid={Boolean(campos.cuit)} />
          </Campo>
          {conCue && (
            <Campo etiqueta="Código CUE" className="flex-1" error={campos.cue}>
              <Input name="cue" placeholder="Ej. 020123400" defaultValue={v("cue")} aria-invalid={Boolean(campos.cue)} />
            </Campo>
          )}
        </div>

        <CampoDireccion
          proposito="institucion"
          defaultValue={v("direccion")}
          campoPartido="partido"
          campoProvincia="provincia"
          ayuda="Escribí calle, número y localidad: ubicamos la institución y completamos el partido y la provincia."
          error={campos.direccion}
          required
        />

        <div className="flex gap-3.5 max-[640px]:flex-col">
          <Campo etiqueta="Partido" className="flex-1" error={campos.partido}>
            <Input name="partido" list={id("partidos")} placeholder="Ej. Vicente López" required defaultValue={v("partido")} aria-invalid={Boolean(campos.partido)} />
          </Campo>
          <Campo etiqueta="Provincia" className="flex-1" error={campos.provincia}>
            <Input name="provincia" list={id("provincias")} placeholder="Ej. Buenos Aires" required defaultValue={v("provincia")} aria-invalid={Boolean(campos.provincia)} />
          </Campo>
        </div>
        <datalist id={id("partidos")}>
          {partidos.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id={id("provincias")}>
          {provincias.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        {/* Solo si la cuenta no los aceptó al crearse (cuentas anteriores): las nuevas ya los aceptaron en el paso 1. */}
        {pedirTerminos && (
          <div>
            <Casilla name="aceptaTerminos" required defaultChecked={yaCreada} className="mt-1.5">
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="font-semibold text-navy-700">
                términos y condiciones
              </Link>{" "}
              de UNIDOAR.
            </Casilla>
            {campos.aceptaTerminos && (
              <p role="alert" className="mt-1 text-xs text-[#b91c1c]">
                {campos.aceptaTerminos}
              </p>
            )}
          </div>
        )}

        <AlertaError>{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
        <Boton type="submit" bloque disabled={pendiente} className="mt-2 min-h-12 text-base">
          {pendiente ? "Guardando…" : "Continuar"}
        </Boton>
      </div>
    </form>
  );
}
