"use client";

import { Boton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/campos";
import { fechaNovedad, hoyArgentinaISO, MAX_NOVEDADES } from "@/lib/vitrina";

export type NovedadEditable = {
  /** Clave estable para React: el id de la base, o uno provisorio mientras la novedad no se guardó. */
  clave: string;
  /** Id de `institucion_novedades`; ausente en las novedades nuevas. */
  id?: string;
  titulo: string;
  texto: string;
  /** yyyy-mm-dd */
  fecha: string;
  /** Recién agregada en esta sesión: el título toma el foco. */
  enfocar?: boolean;
};

/** Campo "de lectura que se edita": sin borde hasta que se pasa el mouse o se enfoca (como el prototipo). */
const EN_LINEA =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-tinta transition-colors placeholder:text-sutil hover:border-borde focus:border-navy-700 focus:bg-white focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none";

/**
 * Novedades de la vitrina ("Abrimos inscripción a Nivel Inicial 2027"): alta, edición y baja, cada una con su
 * fecha. Los cambios quedan en el formulario y se publican con "Guardar cambios".
 */
export function VitrinaNovedades({
  novedades,
  onCambiar,
  errores,
}: {
  novedades: NovedadEditable[];
  onCambiar: (nuevas: NovedadEditable[]) => void;
  errores: Record<string, string>;
}) {
  const llena = novedades.length >= MAX_NOVEDADES;

  const agregar = () =>
    onCambiar([
      { clave: `nueva-${crypto.randomUUID()}`, titulo: "", texto: "", fecha: hoyArgentinaISO(), enfocar: true },
      ...novedades,
    ]);
  const editar = (clave: string, cambio: Partial<NovedadEditable>) =>
    onCambiar(novedades.map((n) => (n.clave === clave ? { ...n, ...cambio } : n)));

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-base leading-none font-semibold">Novedades</span>
        {llena ? (
          <span className="text-[13px] text-sutil">Llegaste al máximo de {MAX_NOVEDADES} novedades.</span>
        ) : (
          <Boton tamano="sm" variante="secundario" onClick={agregar}>
            + Agregar novedad
          </Boton>
        )}
      </div>

      {errores.novedades && (
        <p role="alert" className="m-0 mb-2 text-xs text-[#b91c1c]">
          {errores.novedades}
        </p>
      )}

      {novedades.length === 0 ? (
        <p className="m-0 rounded-interno border-[1.5px] border-dashed border-borde-fuerte px-5 py-8 text-center text-[13.5px] leading-normal text-apagado">
          Todavía no publicaste novedades. Contá cuándo abre una inscripción, qué obra terminaron o qué cargos van a necesitar.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {novedades.map((n, i) => {
            const errTitulo = errores[`novedades.${i}.titulo`];
            const errTexto = errores[`novedades.${i}.texto`];
            const errFecha = errores[`novedades.${i}.fecha`];
            return (
              <li key={n.clave} className="flex gap-3.5 border-b border-borde pb-3.5 last:border-b-0 last:pb-0 max-[560px]:flex-col max-[560px]:gap-1.5">
                <div className="w-11 flex-none text-center text-[11px] leading-[1.3] font-semibold text-sutil max-[560px]:w-auto max-[560px]:text-left">
                  {n.fecha ? fechaNovedad(n.fecha) : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    aria-label={`Título de la novedad ${i + 1}`}
                    aria-invalid={Boolean(errTitulo)}
                    value={n.titulo}
                    onChange={(e) => editar(n.clave, { titulo: e.target.value })}
                    placeholder="Título de la novedad"
                    maxLength={120}
                    autoFocus={n.enfocar}
                    className={`${EN_LINEA} text-sm leading-[1.3] font-semibold`}
                  />
                  {errTitulo && (
                    <p role="alert" className="m-0 px-1.5 text-xs text-[#b91c1c]">
                      {errTitulo}
                    </p>
                  )}
                  <Textarea
                    aria-label={`Texto de la novedad ${i + 1}`}
                    aria-invalid={Boolean(errTexto)}
                    value={n.texto}
                    onChange={(e) => editar(n.clave, { texto: e.target.value })}
                    placeholder="Contá la novedad en un par de líneas"
                    maxLength={1000}
                    className="mt-1 min-h-[56px] text-[13px] leading-normal"
                  />
                  {errTexto && (
                    <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
                      {errTexto}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-apagado">
                      Fecha
                      <Input
                        type="date"
                        value={n.fecha}
                        onChange={(e) => editar(n.clave, { fecha: e.target.value })}
                        aria-invalid={Boolean(errFecha)}
                        className="w-auto px-2.5 py-1 text-[13px]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onCambiar(novedades.filter((x) => x.clave !== n.clave))}
                      className="rounded text-xs font-medium text-sutil transition-colors hover:text-[#dc2626] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
                    >
                      Eliminar novedad
                    </button>
                  </div>
                  {errFecha && (
                    <p role="alert" className="m-0 mt-1 text-xs text-[#b91c1c]">
                      {errFecha}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
