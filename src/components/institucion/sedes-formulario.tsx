"use client";

import { useRef, useState, useTransition } from "react";
import { actualizarSedesComoAdmin } from "@/app/actions/backoffice-instituciones";
import { actualizarSedes } from "@/app/actions/institucion";
import { Boton } from "@/components/ui/button";
import { CampoDireccion, type Sugerencia } from "@/components/ui/campo-direccion";
import { Campo, Input } from "@/components/ui/campos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { MAX_SEDES, NOMBRE_SEDE_PRINCIPAL, type SedeVista } from "@/lib/sedes";

/** Lo que el formulario necesita de cada sede para arrancar. */
export type SedeInicial = Pick<SedeVista, "nombre" | "direccion" | "zona" | "cue" | "esPrincipal"> & { id?: string };

type Fila = {
  /** Clave estable de la fila en pantalla: el id de la sede, o uno provisorio si todavía no se guardó. */
  clave: string;
  id?: string;
  nombre: string;
  direccion: string;
  zona: string;
  cue: string;
  esPrincipal: boolean;
  /** Firma de la sugerencia de ubicación que eligió la persona (el servidor la verifica antes de usarla). */
  firma: string;
  /** La última zona que se completó sola: si la persona no la tocó, se puede reemplazar por la de la dirección nueva. */
  zonaAuto: string;
};

const aFila = (s: SedeInicial): Fila => ({
  clave: s.id ?? "principal",
  id: s.id,
  nombre: s.nombre,
  direccion: s.direccion ?? "",
  zona: s.zona ?? "",
  cue: s.cue ?? "",
  esPrincipal: s.esPrincipal,
  firma: "",
  zonaAuto: "",
});

/**
 * Las sedes de una institución: nombre, dirección (que se ubica sola) y zona de cada una, cuál es la principal y, solo para el equipo
 * de UNIDOAR, el CUE. Se guarda la lista completa de una vez; el servidor vuelve a validar todo. Con `institucionIdAdmin` guarda como
 * equipo (el id de la institución se valida en el servidor).
 */
export function SedesFormulario({
  sedes,
  huella,
  conCue = false,
  institucionIdAdmin,
}: {
  sedes: SedeInicial[];
  /** Huella de las sedes guardadas cuando se abrió la pantalla (`huellaDeSedes`): el servidor no pisa lo que otra persona cambió mientras tanto. */
  huella: string;
  /** Solo el equipo, y solo en los tipos de institución que son establecimientos educativos. */
  conCue?: boolean;
  institucionIdAdmin?: string;
}) {
  const admin = Boolean(institucionIdAdmin);
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [filas, setFilas] = useState<Fila[]>(() => sedes.map(aFila));
  // Contra qué se compara el próximo guardado: lo que se abrió, y después lo que quedó guardado con el último "Guardar".
  const [huellaBase, setHuellaBase] = useState(huella);
  const [errores, setErrores] = useState<Record<string, string>>({});
  /** El motivo de un rechazo que no es de un campo (por ejemplo, quitar una sede con búsquedas abiertas): queda a la vista. */
  const [rechazo, setRechazo] = useState<string | null>(null);
  const contador = useRef(0);

  const cambiar = (clave: string, cambios: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));

  const agregar = () => {
    if (filas.length >= MAX_SEDES) return;
    contador.current += 1;
    setFilas((fs) => [
      ...fs,
      { clave: `nueva-${contador.current}`, nombre: "", direccion: "", zona: "", cue: "", esPrincipal: false, firma: "", zonaAuto: "" },
    ]);
  };

  const quitar = (clave: string) => setFilas((fs) => fs.filter((f) => f.clave !== clave));

  const hacerPrincipal = (clave: string) => setFilas((fs) => fs.map((f) => ({ ...f, esPrincipal: f.clave === clave })));

  // Al tomar una sugerencia de ubicación, la zona se completa sola si estaba vacía o si era la que se había puesto antes sola.
  const alElegirUbicacion = (clave: string, s: Sugerencia | null) =>
    setFilas((fs) =>
      fs.map((f) => {
        if (f.clave !== clave) return f;
        const completar = Boolean(s) && (!f.zona.trim() || f.zona === f.zonaAuto);
        return { ...f, firma: s?.token ?? "", ...(completar && s ? { zona: s.zona, zonaAuto: s.zona } : {}) };
      }),
    );

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrores({});
    setRechazo(null);
    empezar(async () => {
      try {
        const carga = {
          huella: huellaBase,
          sedes: filas.map((f) => ({
            ...(f.id ? { id: f.id } : {}),
            nombre: f.nombre,
            direccion: f.direccion,
            zona: f.zona,
            ...(conCue ? { cue: f.cue } : {}),
            ubicacion: f.firma,
            esPrincipal: f.esPrincipal,
          })),
        };
        const r = institucionIdAdmin ? await actualizarSedesComoAdmin(institucionIdAdmin, carga) : await actualizarSedes(carga);
        if (r.ok) {
          // Las sedes vuelven con sus ids: así el próximo guardado actualiza en vez de duplicar.
          setFilas(r.data.sedes.map(aFila));
          setHuellaBase(r.data.huella);
          toast(admin ? "Sedes guardadas." : "Sedes guardadas: ya se ven en tu perfil y en tus búsquedas.");
        } else {
          setErrores(r.campos ?? {});
          setRechazo(r.error);
          toast(r.error, "error");
        }
      } catch {
        toast("No pudimos guardar las sedes. Probá de nuevo.", "error");
      }
    });
  };

  const varias = filas.length > 1;

  return (
    <Tarjeta como="section" id="sedes" className="mt-6 scroll-mt-24 p-[22px]" aria-labelledby="titulo-sedes">
      <form onSubmit={guardar} noValidate>
        <h2 id="titulo-sedes" className="font-display m-0 mb-1 text-[18px] leading-none font-semibold text-navy-900">
          Sedes
        </h2>
        <p className="m-0 mb-4 max-w-[640px] text-[13px] leading-[1.5] text-apagado">
          {admin
            ? "Los lugares donde trabaja esta institución. La sede principal es la que figura como dirección de la institución."
            : "Cada sede es un lugar donde trabajan tus profesionales. Se numeran solas (la principal es la 1). Al publicar una búsqueda elegís en qué sedes es, una o varias. La sede principal es la que figura como dirección de tu institución."}
        </p>

        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {filas.map((f, i) => (
            <li key={f.clave} className="rounded-interno border border-linea bg-[#F7F6F2] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-2 font-display text-[15px] font-semibold text-navy-900">
                  <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full bg-navy-900 font-sans text-[12.5px] text-white">
                    {i + 1}
                  </span>
                  Sede {i + 1}
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-tinta">
                  <input
                    type="radio"
                    name="sede-principal"
                    checked={f.esPrincipal}
                    onChange={() => hacerPrincipal(f.clave)}
                    className="size-4 accent-[var(--color-navy-700)]"
                  />
                  Sede principal
                </label>
                {varias && !f.esPrincipal && (
                  <button
                    type="button"
                    onClick={() => quitar(f.clave)}
                    aria-label={`Quitar la sede ${f.nombre || i + 1}`}
                    className="cursor-pointer rounded text-[13px] leading-none font-medium text-[#b91c1c] hover:underline focus-visible:ring-[3px] focus-visible:ring-[#dc2626]/30 focus-visible:outline-none"
                  >
                    Quitar sede
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">
                <Campo etiqueta="Nombre de la sede" requerido error={errores[`sedes.${i}.nombre`]}>
                  <Input
                    value={f.nombre}
                    maxLength={60}
                    placeholder={i === 0 ? NOMBRE_SEDE_PRINCIPAL : "Ej. Sede Pilar"}
                    aria-invalid={Boolean(errores[`sedes.${i}.nombre`])}
                    onChange={(e) => cambiar(f.clave, { nombre: e.target.value })}
                  />
                </Campo>
                <Campo etiqueta="Zona" error={errores[`sedes.${i}.zona`]} ayuda="Se completa sola con la dirección; la podés ajustar.">
                  <Input
                    value={f.zona}
                    maxLength={160}
                    placeholder="Ej. Villa Adelina, Vicente López"
                    aria-invalid={Boolean(errores[`sedes.${i}.zona`])}
                    onChange={(e) => cambiar(f.clave, { zona: e.target.value })}
                  />
                </Campo>
                <CampoDireccion
                  name={`direccion-${f.clave}`}
                  proposito="institucion"
                  defaultValue={f.direccion}
                  enviarFirma={false}
                  onCambioTexto={(v) => cambiar(f.clave, { direccion: v })}
                  onElegida={(s) => alElegirUbicacion(f.clave, s)}
                  ayuda="Si la cambiás, volvemos a ubicarla para calcular las distancias."
                  error={errores[`sedes.${i}.direccion`]}
                  requerido
                  className="col-span-2 max-[640px]:col-span-1"
                />
                {conCue && (
                  <Campo etiqueta="CUE de esta sede" error={errores[`sedes.${i}.cue`]}>
                    <Input
                      value={f.cue}
                      maxLength={20}
                      autoComplete="off"
                      aria-invalid={Boolean(errores[`sedes.${i}.cue`])}
                      onChange={(e) => cambiar(f.clave, { cue: e.target.value })}
                    />
                  </Campo>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Boton type="button" variante="secundario" tamano="md" onClick={agregar} disabled={pendiente || filas.length >= MAX_SEDES}>
            + Agregar sede
          </Boton>
          <div className="flex flex-wrap items-center gap-3">
            {rechazo && (
              <span role="alert" className="max-w-[460px] text-[13px] leading-snug text-[#b91c1c]">
                {rechazo} Los cambios no se guardaron: recargá la página para ver las sedes como están.
              </span>
            )}
            <Boton type="submit" variante="primario" tamano="md" disabled={pendiente} aria-busy={pendiente}>
              {pendiente ? "Guardando…" : "Guardar sedes"}
            </Boton>
          </div>
        </div>
      </form>
    </Tarjeta>
  );
}
