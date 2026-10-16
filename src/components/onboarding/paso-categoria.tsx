"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { guardarCategoriaDocente } from "@/app/actions/onboarding";
import type { CategoriaDocente } from "@/db/schema";
import { Boton } from "@/components/ui/button";
import { AlertaError, SeccionPaso } from "@/components/onboarding/elementos";
import { Campo, Casilla, Input } from "@/components/ui/campos";
import { SelectorAsignaturas } from "@/components/onboarding/selector-asignaturas";
import { CATEGORIAS } from "@/lib/catalogo";
import {
  CATEGORIA_ALTA,
  ID_FORMULARIO_ONBOARDING,
  SITUACIONES_ESTUDIO,
  type SituacionEstudio,
} from "@/lib/onboarding";
import type { CatalogoAsignaturas } from "@/lib/queries/onboarding";
import { cn } from "@/lib/utils";

/**
 * "¿Qué sos?": categoría, asignaturas (rubro → asignatura, del catálogo en base) y si ya se recibió.
 * Es el primer paso con sesión del docente: al continuar se crea su perfil.
 */
export function PasoCategoria({
  catalogo,
  inicial,
  pedirTerminos,
}: {
  catalogo: CatalogoAsignaturas;
  /** La cuenta todavía no aceptó los términos (entró con Google desde "Ingresar"): se piden acá, antes de crear el perfil. */
  pedirTerminos: boolean;
  inicial: { categoria: CategoriaDocente; asignaturas: string[]; estudio: SituacionEstudio; porcentaje: string };
}) {
  const [estado, accion, pendiente] = useActionState(guardarCategoriaDocente, null);
  const [categoria, setCategoria] = useState(inicial.categoria);
  const [elegidas, setElegidas] = useState(inicial.asignaturas);
  const [estudio, setEstudio] = useState(inicial.estudio);
  const [porcentaje, setPorcentaje] = useState(inicial.porcentaje);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};

  const elegirCategoria = (c: CategoriaDocente) => {
    setCategoria(c);
    // Las asignaturas de otra categoría dejan de tener sentido: se descartan.
    const validas = new Set(catalogo[c].flatMap((g) => g.items));
    setElegidas((previas) => previas.filter((a) => validas.has(a)));
  };

  const credencial = CATEGORIA_ALTA[categoria].credencial.nombre;
  const tarjeta = "cursor-pointer rounded-xl border-2 bg-white transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-navy-700/30";

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      {/* Sin título ni bajada a la vista; el encabezado queda solo para lectores de pantalla. */}
      <h1 className="sr-only">Elegí tu categoría</h1>
      {/* Las columnas dependen del ancho del formulario (no de la pantalla): en una columna angosta "Entrenador/a / Instructor/a" se partía en tres renglones. */}
      <div className="@container mb-6">
        <div role="radiogroup" aria-label="Categoría" className="grid grid-cols-1 gap-2.5 @min-[520px]:grid-cols-3">
          {CATEGORIAS.map((c) => {
            const seleccionada = categoria === c;
            return (
              <label
                key={c}
                className={cn(
                  tarjeta,
                  "flex flex-row items-center gap-3.5 p-4 @min-[520px]:flex-col @min-[520px]:items-stretch @min-[520px]:gap-2.5",
                  seleccionada ? "border-navy-700" : "border-borde",
                )}
              >
                <input type="radio" name="categoria" value={c} checked={seleccionada} onChange={() => elegirCategoria(c)} className="sr-only" />
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-6 flex-none items-center justify-center rounded-full text-xs leading-none font-bold",
                    seleccionada ? "bg-navy-700 text-white" : "border border-borde bg-[#F0EFEA]",
                  )}
                >
                  {seleccionada ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-[3px] block text-base leading-snug font-semibold text-tinta">{CATEGORIA_ALTA[c].label}</span>
                  <span className="block text-[13px] leading-[1.45] text-apagado">{CATEGORIA_ALTA[c].desc}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      {campos.categoria && (
        <p role="alert" className="-mt-3.5 mb-4 text-xs text-[#b91c1c]">
          {campos.categoria}
        </p>
      )}

      <SeccionPaso
        titulo="¿Qué enseñás?"
        bajada="Elegí el rubro y después la asignatura. Sumá todas las que dés: cuantas más, en más búsquedas aparecés."
        className="mb-0"
      >
        <SelectorAsignaturas key={categoria} grupos={catalogo[categoria]} elegidas={elegidas} onCambio={setElegidas} error={campos.asignaturas} />
      </SeccionPaso>

      <SeccionPaso
        titulo="¿Ya te recibiste?"
        bajada="Si todavía estás cursando también podés trabajar: no te pedimos el título hasta que lo tengas, sino la constancia de alumno regular."
        className="mb-0"
      >
        <div role="radiogroup" aria-label="¿Ya te recibiste?" className="mb-[22px] flex gap-2.5 max-[640px]:flex-col">
          {SITUACIONES_ESTUDIO.map((s) => {
            const seleccionada = estudio === s.clave;
            return (
              <label key={s.clave} className={cn(tarjeta, "min-w-0 flex-1 p-[18px] text-center", seleccionada ? "border-navy-700" : "border-borde")}>
                <input type="radio" name="estudio" value={s.clave} checked={seleccionada} onChange={() => setEstudio(s.clave)} className="sr-only" />
                <span className="mb-[3px] block text-[15px] leading-snug font-semibold text-tinta">{s.etiqueta}</span>
                <span className="block text-[12.5px] leading-[1.4] text-apagado">{s.desc}</span>
              </label>
            );
          })}
        </div>
      </SeccionPaso>

      {estudio === "estudiante" && (
        <div className="mb-[22px]">
          <Campo
            etiqueta="Porcentaje de materias aprobadas"
            requerido
            error={campos.porcentaje}
            ayuda="Aproximado. Lo respalda la constancia de alumno regular que subís en el último paso."
          >
            <Input
              name="porcentaje"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              placeholder="Ej. 70"
              required
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              aria-invalid={Boolean(campos.porcentaje)}
              className="max-w-[160px]"
            />
          </Campo>
        </div>
      )}

      <div className="mb-[22px] rounded-[10px] bg-[#F0EFEA] px-4 py-3.5 text-[13.5px] leading-normal text-tinta-2">
        {estudio === "estudiante" ? (
          <>
            No te pedimos título: alcanza con el <b className="font-semibold text-tinta">DNI</b> y la{" "}
            <b className="font-semibold text-tinta">constancia de alumno regular</b>. Subís el título cuando te recibas.
          </>
        ) : (
          <>
            Te vamos a pedir <b className="font-semibold text-tinta">{credencial}</b>.
          </>
        )}
      </div>

      {pedirTerminos && (
        <div className="mb-4">
          <Casilla name="aceptaTerminos" required>
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

      <AlertaError className="mb-3.5">{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
      <Boton type="submit" bloque disabled={pendiente} className="min-h-12 text-base">
        {pendiente ? "Guardando…" : "Continuar"}
      </Boton>
    </form>
  );
}
