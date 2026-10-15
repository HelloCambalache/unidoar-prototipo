"use client";

import { Fragment, useState, useTransition } from "react";
import {
  agregarAsignatura,
  eliminarAsignatura,
  renombrarAsignatura,
  renombrarRubro,
} from "@/app/actions/backoffice-categorias";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { useFiltrosUrl } from "@/components/docente/filtros-url";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Tabla } from "@/components/ui/tabla";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/busquedas";
import type { CategoriaDocente } from "@/db/schema";
import type { AsignaturaFila, RubroGrupo } from "@/lib/queries/backoffice-categorias";

const NUEVO_RUBRO = "__nuevo__";

type Dialogo =
  | { tipo: "renombrar"; a: AsignaturaFila; rubro: string }
  | { tipo: "eliminar"; a: AsignaturaFila; rubro: string; ultimaDelRubro: boolean }
  | { tipo: "rubro"; rubro: string }
  | null;

/** "3 docentes y 2 búsquedas (1 activa)" · null si nadie la usa. */
function textoDeUso(a: AsignaturaFila) {
  const partes: string[] = [];
  if (a.docentes > 0) partes.push(plural(a.docentes, "profesional", "profesionales"));
  if (a.busquedasTotal > 0) {
    const activas = a.busquedasActivas > 0 ? ` (${plural(a.busquedasActivas, "activa", "activas")})` : "";
    partes.push(`${plural(a.busquedasTotal, "búsqueda", "búsquedas")}${activas}`);
  }
  return partes.length ? partes.join(" y ") : null;
}

/** Texto de un botón de acción de fila (los de la tabla: "Renombrar", "Eliminar"). */
const BOTON_FILA =
  "rounded-md px-1.5 py-1 text-[13px] leading-none font-medium text-apagado transition-colors hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

/**
 * ABM de asignaturas de una categoría: agregar (a un rubro existente o creando uno), renombrar, eliminar y
 * renombrar rubros. Antes de renombrar o eliminar se muestra cuántos docentes y búsquedas la usan y se pide
 * confirmación; el servidor vuelve a calcularlo y actualiza esas filas en la misma transacción.
 */
export function CatEditor({
  categoria,
  rubros,
  rubrosCompletos,
  consulta,
  totalAsignaturas,
}: {
  categoria: CategoriaDocente;
  /** Rubros ya filtrados por la búsqueda. */
  rubros: RubroGrupo[];
  /** Todos los rubros de la categoría con su cantidad de asignaturas, sin filtrar (selector de "Agregar" y chequeo de "última del rubro"). */
  rubrosCompletos: { rubro: string; cantidad: number }[];
  consulta: string;
  totalAsignaturas: number;
}) {
  const toast = useToast();
  const { aplicarConDemora, pendiente: buscando } = useFiltrosUrl();
  const [pendiente, empezar] = useTransition();
  const nombresDeRubros = rubrosCompletos.map((r) => r.rubro);

  /* Formulario de alta */
  const [rubroElegido, setRubroElegido] = useState(nombresDeRubros[0] ?? NUEVO_RUBRO);
  const [rubroNuevo, setRubroNuevo] = useState("");
  const [nombre, setNombre] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const creandoRubro = rubroElegido === NUEVO_RUBRO || nombresDeRubros.length === 0;
  // Si el rubro elegido desapareció (lo renombraron o borraron), se vuelve al primero.
  const rubroValido = creandoRubro || nombresDeRubros.includes(rubroElegido) ? rubroElegido : (nombresDeRubros[0] ?? NUEVO_RUBRO);

  /* Diálogos */
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [texto, setTexto] = useState("");
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null);

  const abrir = (d: Exclude<Dialogo, null>) => {
    setDialogo(d);
    setErrorDialogo(null);
    setTexto(d.tipo === "renombrar" ? d.a.nombre : d.tipo === "rubro" ? d.rubro : "");
  };
  const cerrar = () => {
    setDialogo(null);
    setErrorDialogo(null);
  };

  const agregar = () => {
    setErrores({});
    const esNuevo = rubroValido === NUEVO_RUBRO || nombresDeRubros.length === 0;
    empezar(async () => {
      try {
        const r = await agregarAsignatura({
          categoria,
          rubro: esNuevo ? rubroNuevo : rubroValido,
          nombre,
          nuevoRubro: esNuevo,
        });
        if (!r.ok) {
          setErrores(r.campos ?? { nombre: r.error });
          toast(r.error, "error");
          return;
        }
        toast(`«${nombre.trim()}» agregada`);
        setNombre("");
        if (esNuevo) {
          setRubroElegido(rubroNuevo.trim());
          setRubroNuevo("");
        }
      } catch {
        toast("No pudimos agregar la asignatura. Probá de nuevo.", "error");
      }
    });
  };

  const confirmar = () => {
    if (!dialogo) return;
    setErrorDialogo(null);
    empezar(async () => {
      try {
        if (dialogo.tipo === "renombrar") {
          const r = await renombrarAsignatura(dialogo.a.id, texto);
          if (!r.ok) {
            setErrorDialogo(r.error);
            toast(r.error, "error");
            return;
          }
          const alcanzados = r.data.docentes + r.data.busquedasTotal;
          toast(
            alcanzados > 0
              ? `Renombrada. Se actualizaron ${plural(r.data.docentes, "perfil", "perfiles")} y ${plural(r.data.busquedasTotal, "búsqueda", "búsquedas")}.`
              : "Asignatura renombrada",
          );
        } else if (dialogo.tipo === "eliminar") {
          const r = await eliminarAsignatura(dialogo.a.id, dialogo.ultimaDelRubro);
          if (!r.ok) {
            setErrorDialogo(r.error);
            toast(r.error, "error");
            return;
          }
          toast(r.data.rubroEliminado ? `«${dialogo.a.nombre}» eliminada junto con su rubro` : `«${dialogo.a.nombre}» eliminada`);
        } else {
          const r = await renombrarRubro(categoria, dialogo.rubro, texto);
          if (!r.ok) {
            setErrorDialogo(r.error);
            toast(r.error, "error");
            return;
          }
          toast("Rubro renombrado");
        }
        cerrar();
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  const uso = dialogo && dialogo.tipo !== "rubro" ? textoDeUso(dialogo.a) : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-2.5 rounded-tarjeta border border-linea bg-white px-[18px] py-4">
          <Input
            type="search"
            aria-label="Buscar asignatura"
            placeholder="Buscar asignatura"
            defaultValue={consulta}
            aria-busy={buscando}
            onChange={(e) => aplicarConDemora("q", e.target.value)}
            className="max-w-[280px] min-w-[180px] flex-1"
          />
          <form
            className="ml-auto flex flex-wrap items-start gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              agregar();
            }}
          >
            <Campo className="w-[200px] max-w-full">
              <Select aria-label="Rubro" value={rubroValido} onChange={(e) => setRubroElegido(e.target.value)}>
                {nombresDeRubros.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value={NUEVO_RUBRO}>＋ Nuevo rubro…</option>
              </Select>
            </Campo>
            {creandoRubro && (
              <Campo className="w-[200px] max-w-full" error={errores.rubro}>
                <Input
                  aria-label="Nombre del rubro nuevo"
                  placeholder="Nombre del rubro nuevo"
                  value={rubroNuevo}
                  maxLength={80}
                  onChange={(e) => setRubroNuevo(e.target.value)}
                  aria-invalid={!!errores.rubro || undefined}
                />
              </Campo>
            )}
            <Campo className="w-[200px] max-w-full" error={errores.nombre}>
              <Input
                aria-label="Nombre de la asignatura"
                placeholder="Ej. Robótica"
                value={nombre}
                maxLength={100}
                onChange={(e) => setNombre(e.target.value)}
                aria-invalid={!!errores.nombre || undefined}
              />
            </Campo>
            <Boton type="submit" disabled={pendiente || !nombre.trim()}>
              Agregar
            </Boton>
          </form>
        </div>

        {rubros.length === 0 ? (
          <EstadoVacio
            titulo={totalAsignaturas === 0 ? "Esta categoría no tiene asignaturas" : "No hay asignaturas que coincidan"}
            texto={totalAsignaturas === 0 ? "Agregá la primera con el formulario de arriba." : "Probá con otra palabra."}
          />
        ) : (
          <Tabla className="min-w-[560px]">
            <thead>
              <tr>
                <th>Asignatura / disciplina</th>
                <th>Profesionales</th>
                <th>Búsquedas activas</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rubros.map((g) => (
                <Fragment key={g.rubro}>
                  <tr className="bg-superficie">
                    <td colSpan={3} className="text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">
                      {g.rubro}
                    </td>
                    <td className="text-right">
                      <button type="button" className={BOTON_FILA} onClick={() => abrir({ tipo: "rubro", rubro: g.rubro })} aria-label={`Renombrar el rubro ${g.rubro}`}>
                        Renombrar rubro
                      </button>
                    </td>
                  </tr>
                  {g.asignaturas.map((a) => (
                    <tr key={a.id}>
                      <td className="font-semibold">{a.nombre}</td>
                      <td>{a.docentes}</td>
                      <td>{a.busquedasActivas}</td>
                      <td className="text-right whitespace-nowrap">
                        <button type="button" className={BOTON_FILA} onClick={() => abrir({ tipo: "renombrar", a, rubro: g.rubro })} aria-label={`Renombrar ${a.nombre}`}>
                          Renombrar
                        </button>
                        <button
                          type="button"
                          className={BOTON_FILA}
                          onClick={() =>
                            abrir({
                              tipo: "eliminar",
                              a,
                              rubro: g.rubro,
                              // Con la búsqueda activa el grupo puede estar recortado: se mira el rubro completo.
                              ultimaDelRubro: (rubrosCompletos.find((r) => r.rubro === g.rubro)?.cantidad ?? 0) <= 1,
                            })
                          }
                          aria-label={`Eliminar ${a.nombre}`}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </Tabla>
        )}
      </div>

      <DialogoModal
        abierto={!!dialogo}
        onCerrar={cerrar}
        titulo={
          dialogo?.tipo === "renombrar"
            ? `Renombrar «${dialogo.a.nombre}»`
            : dialogo?.tipo === "eliminar"
              ? `¿Eliminar «${dialogo.a.nombre}»?`
              : dialogo?.tipo === "rubro"
                ? `Renombrar el rubro «${dialogo.rubro}»`
                : ""
        }
      >
        {dialogo && (
          <>
            {dialogo.tipo === "rubro" && (
              <p className="m-0 mb-4 text-sm leading-normal text-apagado">
                El nuevo nombre se aplica a todas las asignaturas del rubro.
              </p>
            )}
            {dialogo.tipo === "renombrar" && (
              <p className="m-0 mb-4 text-sm leading-normal text-apagado">
                {uso ? (
                  <>
                    La usan <b className="font-semibold text-tinta-2">{uso}</b>. Se actualizan con el nuevo nombre en sus perfiles y
                    búsquedas.
                  </>
                ) : (
                  "Todavía no la usa ningún perfil ni búsqueda."
                )}
              </p>
            )}
            {dialogo.tipo === "eliminar" && (
              <>
                <p className="m-0 mb-3 text-sm leading-normal text-apagado">
                  {uso ? (
                    <>
                      La usan <b className="font-semibold text-tinta-2">{uso}</b>. Esos perfiles y búsquedas la conservan, pero deja
                      de ofrecerse al publicar búsquedas y en el alta.
                    </>
                  ) : (
                    "Todavía no la usa ningún perfil ni búsqueda. Deja de ofrecerse al publicar búsquedas y en el alta."
                  )}
                </p>
                {dialogo.ultimaDelRubro && (
                  <p className="m-0 mb-3 rounded-lg bg-[#FEF1DF] px-3 py-2 text-[13px] leading-normal text-[#8A4B07]">
                    Es la última de «{dialogo.rubro}»: el rubro también se elimina.
                  </p>
                )}
              </>
            )}
            {dialogo.tipo !== "eliminar" && (
              <div className="mb-4">
                <Campo etiqueta={dialogo.tipo === "rubro" ? "Nombre del rubro" : "Nuevo nombre"} requerido error={errorDialogo ?? undefined}>
                  <Input
                    value={texto}
                    maxLength={dialogo.tipo === "rubro" ? 80 : 100}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmar();
                      }
                    }}
                    aria-invalid={!!errorDialogo || undefined}
                  />
                </Campo>
              </div>
            )}
            {dialogo.tipo === "eliminar" && errorDialogo && (
              <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
                {errorDialogo}
              </p>
            )}
            <div className="flex gap-2.5">
              <Boton
                variante={dialogo.tipo === "eliminar" ? "peligro" : "primario"}
                disabled={pendiente || (dialogo.tipo !== "eliminar" && !texto.trim())}
                onClick={confirmar}
              >
                {pendiente ? "Guardando…" : dialogo.tipo === "eliminar" ? "Eliminar" : "Guardar"}
              </Boton>
              <Boton variante="secundario" disabled={pendiente} onClick={cerrar}>
                Cancelar
              </Boton>
            </div>
          </>
        )}
      </DialogoModal>
    </>
  );
}
