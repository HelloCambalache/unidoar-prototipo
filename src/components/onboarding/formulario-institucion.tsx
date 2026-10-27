"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearInstitucion } from "@/app/actions/onboarding";
import { Boton } from "@/components/ui/button";
import { CampoDireccion } from "@/components/ui/campo-direccion";
import { Campo, Casilla, Input, Select } from "@/components/ui/campos";
import { AlertaError, TituloPaso } from "@/components/onboarding/elementos";
import { ROLES_CONTACTO, TIPOS_CON_CUE, TIPOS_INSTITUCION } from "@/lib/catalogo";
import { OTRO, opcionYTexto } from "@/lib/otro";
import { resumenDeSemestre } from "@/lib/forma-de-pago";
import { crearPlanes, pesos, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";
import { ID_FORMULARIO_ONBOARDING, valorDe, type DatosForm } from "@/lib/onboarding";

/** Cómo quiere usar UNIDOAR en el alta: el abono de su tipo mes a mes, el mismo abono por semestre o una sola búsqueda (ver `planDelAlta`). */
export type Modalidad = "abono" | "semestral" | "puntual";

/** Una de las maneras de usar UNIDOAR (radio con forma de tarjeta). */
function OpcionDePlan({
  valor,
  marcada,
  alElegir,
  titulo,
  precio,
  texto,
}: {
  valor: Modalidad;
  marcada: boolean;
  alElegir: () => void;
  titulo: string;
  precio: string;
  texto: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-caja border border-borde bg-white p-3.5 transition-colors has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-navy-700/30">
      {/* Controlado por el estado del formulario: React vacía los campos no controlados después de cada envío (también si falló la validación),
          y una elección de «Una sola búsqueda» volvería sola a «Abono mensual». */}
      <input type="radio" name="modalidad" value={valor} checked={marcada} onChange={alElegir} className="mt-1 size-4 flex-none accent-navy-700" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2 text-[15px] leading-tight font-semibold text-tinta">
          {titulo}
          <span className="text-[13px] font-medium text-navy-700">{precio}</span>
        </span>
        <span className="mt-1 block text-[13px] leading-normal text-apagado">{texto}</span>
      </span>
    </label>
  );
}

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
  catalogo,
  modalidadInicial,
  fundadora,
}: {
  inicial: DatosForm;
  yaCreada: boolean;
  /** La cuenta no tiene la constancia de los términos (se creó antes de que se aceptaran en el paso 1): se piden acá. */
  pedirTerminos: boolean;
  partidos: string[];
  provincias: string[];
  /** Los planes vigentes: de ahí salen los precios que se muestran y si se ofrece pagar una sola búsqueda. */
  catalogo: CatalogoDePlanes;
  /** Con qué opción arranca (la de una cuenta que vuelve a este paso: la que ya tenía). */
  modalidadInicial: Modalidad;
  /**
   * Lugares de institución fundadora: con el abono (mensual o semestral) la cuenta queda con el Plan Fundador y su valor no se muestra acá (lo
   * define el equipo). null: no hay lugares (o el plan está apagado) y todo se ve como siempre. `yaLoEs`: la cuenta que vuelve a este paso ya es fundadora.
   */
  fundadora: null | { quedan: number; total: number; yaLoEs: boolean };
}) {
  const [estado, accion, pendiente] = useActionState(crearInstitucion, null);
  // Si ya había guardado algo escrito a mano ("Academia de danza"), el desplegable queda en "Otro" y el texto en "¿Cuál?".
  const inicialTipo = opcionYTexto(inicial.tipo, TIPOS_INSTITUCION);
  const inicialRol = opcionYTexto(inicial.contactoRol, ROLES_CONTACTO);
  const [tipo, setTipo] = useState<string>(inicialTipo.opcion || TIPOS_INSTITUCION[0]);
  const [rol, setRol] = useState<string>(inicialRol.opcion || ROLES_CONTACTO[0]);
  // Cómo quiere usar UNIDOAR: en el estado (no en el DOM) para que sobreviva a un envío que falla y vuelve a mostrar el formulario.
  const [modalidad, setModalidad] = useState<Modalidad>(modalidadInicial);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const v = (campo: string) => valorDe(estado, inicial, campo);
  const conCue = TIPOS_CON_CUE.includes(tipo);
  const id = (c: string) => `inst-${c}`;
  // El abono que le toca sale del tipo que está eligiendo; pagar una sola búsqueda solo se ofrece si ese plan se sigue ofreciendo.
  const P = crearPlanes(catalogo);
  const abono = P.planDe(P.planPorTipo(tipo));
  const semestre = resumenDeSemestre(P, P.planPorTipo(tipo) as PlanClave, 1);
  const puntual = P.planDe("puntual");
  const { vigenciaDias, incluyeCursos, incluyeBuscador } = P.condiciones.puntual;
  const noIncluye = [!incluyeBuscador && "el buscador de profesionales", !incluyeCursos && "la difusión de cursos"].filter(Boolean).join(" ni ");

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

        {tipo === OTRO && (
          <Campo etiqueta="¿Cuál es el tipo de institución?" error={campos.tipoOtro}>
            <Input
              name="tipoOtro"
              required
              maxLength={60}
              placeholder="Ej. Academia de danza"
              defaultValue={v("tipoOtro") || inicialTipo.texto}
              aria-invalid={Boolean(campos.tipoOtro)}
            />
          </Campo>
        )}

        <Campo etiqueta="Nombre de contacto" error={campos.contactoNombre}>
          <Input name="contactoNombre" autoComplete="name" placeholder="Ej. Marina Gómez" required defaultValue={v("contactoNombre")} aria-invalid={Boolean(campos.contactoNombre)} />
        </Campo>

        <div className="flex gap-3.5 max-[640px]:flex-col">
          <Campo etiqueta="Rol en la institución" className="flex-1" error={campos.contactoRol}>
            <Select name="contactoRol" value={rol} onChange={(e) => setRol(e.target.value)} aria-invalid={Boolean(campos.contactoRol)}>
              {ROLES_CONTACTO.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Teléfono" className="flex-1" error={campos.telefono}>
            <Input name="telefono" type="tel" autoComplete="tel" placeholder="11 5555 5555" required defaultValue={v("telefono")} aria-invalid={Boolean(campos.telefono)} />
          </Campo>
        </div>

        {rol === OTRO && (
          <Campo etiqueta="¿Cuál es tu rol en la institución?" error={campos.contactoRolOtro}>
            <Input
              name="contactoRolOtro"
              required
              maxLength={60}
              placeholder="Ej. Secretaria, Preceptor/a, Dueño/a"
              defaultValue={v("contactoRolOtro") || inicialRol.texto}
              aria-invalid={Boolean(campos.contactoRolOtro)}
            />
          </Campo>
        )}

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

        <fieldset className="m-0 mt-1 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-semibold text-tinta">¿Cómo querés usar UNIDOAR?</legend>
          {fundadora && (
            <p role="note" className="mt-0 mb-3 rounded-caja bg-[#FEF1DF] px-3.5 py-3 text-[13px] leading-normal text-[#8A4B07]">
              <b className="font-semibold">Institución fundadora</b>
              {fundadora.yaLoEs ? "" : ` · quedan ${fundadora.quedan} de ${fundadora.total} lugares`}
              {". "}
              {fundadora.yaLoEs ? "Tu institución es fundadora" : "Con el abono (mensual o semestral) tu institución queda como fundadora"}: valor preferencial, la insignia en tu
              perfil público y tu logo en la portada del sitio. El equipo te confirma el valor cuando verifique tu cuenta.
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            <OpcionDePlan
              valor="abono"
              marcada={modalidad === "abono"}
              alElegir={() => setModalidad("abono")}
              titulo="Abono mensual"
              precio={fundadora ? "Valor de fundadora" : `${pesos(abono.precio)} por mes`}
              texto="Búsquedas ilimitadas, el buscador de profesionales y la difusión de cursos. Sin comisión por contratación."
            />
            <OpcionDePlan
              valor="semestral"
              marcada={modalidad === "semestral"}
              alElegir={() => setModalidad("semestral")}
              titulo="Abono semestral"
              precio={fundadora ? "Valor de fundadora" : `${pesos(semestre.total)} por ${semestre.meses} meses`}
              texto={`Lo mismo que el abono mensual, pagando el semestre de una vez: pagás ${semestre.mesesQueSePagan} meses y usás ${semestre.meses}. El equipo te ayuda a abonarlo cuando verifique tu cuenta.`}
            />
            {puntual.vigente && (
              <OpcionDePlan
                valor="puntual"
                marcada={modalidad === "puntual"}
                alElegir={() => setModalidad("puntual")}
                titulo="Una sola búsqueda"
                precio={`${pesos(puntual.precio)} por búsqueda`}
                texto={`Pagás solo la búsqueda que necesitás, sin abono mensual. Queda publicada ${vigenciaDias} días${noIncluye ? ` y no incluye ${noIncluye}` : ""}. Al terminar el alta te ayudamos a abonarla.`}
              />
            )}
          </div>
          <p className="mt-2 mb-0 text-xs leading-normal text-apagado">
            Si más adelante querés cambiar de modalidad, lo pedís desde Plan y facturación o nos escribís por Contacto.
          </p>
        </fieldset>

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
