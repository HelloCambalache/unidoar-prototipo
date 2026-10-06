"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearBusqueda, editarBusqueda } from "@/app/actions/busquedas";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { PanelCoincidencias, type Interruptores } from "@/components/institucion/panel-coincidencias";
import type { CategoriaDocente } from "@/db/schema";
import { OPCIONES_VENCIMIENTO } from "@/lib/busquedas";
import { CATEGORIA_INFO, CATEGORIAS, NIVELES, TIPOS_BUSQUEDA, TURNOS } from "@/lib/catalogo";

export type ValoresFormulario = {
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: (typeof NIVELES)[number] | "";
  tipo: (typeof TIPOS_BUSQUEDA)[number];
  cargaHoraria: string;
  turno: (typeof TURNOS)[number] | "";
  fechaInicio: string;
  zona: string;
  descripcion: string;
  requisitos: string;
  beneficios: string;
};

export type CatalogoDisciplinas = Record<CategoriaDocente, { rubro: string; items: string[] }[]>;

const OTRA = "__otra";

const enCatalogo = (catalogo: CatalogoDisciplinas, categoria: CategoriaDocente, disciplina: string) =>
  catalogo[categoria].some((g) => g.items.includes(disciplina));

/**
 * Crear y editar una búsqueda. Todos los campos son controlados: React 19 resetea los campos
 * sin controlar cuando termina una acción, y ante un error de validación no queremos perder lo escrito.
 */
export function FormularioBusqueda({
  modo,
  busquedaId,
  inicial,
  catalogo,
  plazoActual,
}: {
  modo: "crear" | "editar";
  busquedaId?: string;
  inicial: ValoresFormulario;
  catalogo: CatalogoDisciplinas;
  /** Solo al editar una rápida: "Vence en 18 hs", para ofrecer conservarlo. */
  plazoActual?: string | null;
}) {
  const accion = modo === "editar" && busquedaId ? editarBusqueda.bind(null, busquedaId) : crearBusqueda;
  const [estado, formAction, pendiente] = useActionState(accion, null);
  const errores = estado?.campos ?? {};

  const [v, setV] = useState(inicial);
  const set = <K extends keyof ValoresFormulario>(clave: K, valor: ValoresFormulario[K]) =>
    setV((previo) => ({ ...previo, [clave]: valor }));

  const [disciplina, setDisciplina] = useState(() =>
    !inicial.disciplina || enCatalogo(catalogo, inicial.categoria, inicial.disciplina)
      ? { sel: inicial.disciplina, otra: "" }
      : { sel: OTRA, otra: inicial.disciplina },
  );
  const disciplinaFinal = disciplina.sel === OTRA ? disciplina.otra.trim() : disciplina.sel;

  const [venceEnHoras, setVenceEnHoras] = useState(plazoActual ? "" : "24");
  const [interruptores, setInterruptores] = useState<Interruptores>({
    ampliarZona: false,
    incluirSinVerificar: false,
    turnoExtra: false,
  });

  const esRapida = v.tipo === "Suplencia rápida";
  const cancelar = modo === "editar" && busquedaId ? `/institucion/postulantes?busqueda=${busquedaId}` : "/institucion/busquedas";

  return (
    <form
      action={formAction}
      className="flex items-start gap-6 max-[1000px]:flex-wrap max-[860px]:flex-col max-[860px]:gap-4"
    >
      <div className="flex w-full max-w-[980px] min-w-0 flex-1 flex-col gap-4 rounded-ud border border-borde bg-white p-6 max-[560px]:p-4">
        <Campo etiqueta="Puesto" requerido error={errores.puesto}>
          <Input
            name="puesto"
            value={v.puesto}
            onChange={(e) => set("puesto", e.target.value)}
            maxLength={120}
            required
            aria-invalid={!!errores.puesto}
            placeholder="Ej. Profe de Educación Física — Primario"
          />
        </Campo>

        <Campo etiqueta="Categoría" requerido error={errores.categoria}>
          <Select
            name="categoria"
            value={v.categoria}
            onChange={(e) => {
              set("categoria", e.target.value as CategoriaDocente);
              setDisciplina((d) => ({ sel: "", otra: d.otra }));
            }}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_INFO[c].label}
              </option>
            ))}
          </Select>
        </Campo>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <div className="flex flex-col gap-2">
            <Campo etiqueta="Disciplina / asignatura" requerido error={errores.disciplina}>
              <Select
                value={disciplina.sel}
                onChange={(e) => setDisciplina((d) => ({ ...d, sel: e.target.value }))}
                aria-invalid={!!errores.disciplina}
                required
              >
                <option value="">Elegí una disciplina</option>
                {catalogo[v.categoria].map((g) => (
                  <optgroup key={g.rubro} label={g.rubro}>
                    {g.items.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTRA}>Otra…</option>
              </Select>
            </Campo>
            <input type="hidden" name="disciplina" value={disciplinaFinal} />
            {disciplina.sel === OTRA && (
              <Campo etiqueta="¿Cuál?" requerido>
                <Input
                  value={disciplina.otra}
                  onChange={(e) => setDisciplina((d) => ({ ...d, otra: e.target.value }))}
                  maxLength={100}
                  placeholder="Escribí la disciplina"
                  required
                />
              </Campo>
            )}
          </div>
          <Campo etiqueta="Nivel" error={errores.nivel}>
            <Select name="nivel" value={v.nivel} onChange={(e) => set("nivel", e.target.value as ValoresFormulario["nivel"])}>
              <option value="">Sin especificar</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Campo etiqueta="Tipo" requerido error={errores.tipo}>
            <Select name="tipo" value={v.tipo} onChange={(e) => set("tipo", e.target.value as ValoresFormulario["tipo"])}>
              {TIPOS_BUSQUEDA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Carga horaria" error={errores.cargaHoraria}>
            <Input
              name="cargaHoraria"
              value={v.cargaHoraria}
              onChange={(e) => set("cargaHoraria", e.target.value)}
              maxLength={80}
              placeholder="Ej. 18 hs semanales"
            />
          </Campo>
        </div>

        {esRapida && (
          <Campo
            etiqueta="Responder antes de"
            ayuda="Pasado ese plazo la búsqueda rápida deja de recibir respuestas."
            error={errores.venceEnHoras}
          >
            <Select name="venceEnHoras" value={venceEnHoras} onChange={(e) => setVenceEnHoras(e.target.value)}>
              {plazoActual && <option value="">Mantener el plazo actual ({plazoActual.toLowerCase()})</option>}
              {OPCIONES_VENCIMIENTO.map((o) => (
                <option key={o.horas} value={o.horas}>
                  {o.etiqueta}
                </option>
              ))}
            </Select>
          </Campo>
        )}

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Campo etiqueta="Turno" error={errores.turno}>
            <Select name="turno" value={v.turno} onChange={(e) => set("turno", e.target.value as ValoresFormulario["turno"])}>
              <option value="">Sin especificar</option>
              {TURNOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Fecha de inicio" error={errores.fechaInicio}>
            <Input
              type="date"
              name="fechaInicio"
              value={v.fechaInicio}
              onChange={(e) => set("fechaInicio", e.target.value)}
            />
          </Campo>
        </div>

        <Campo etiqueta="Zona" ayuda="Tomada del perfil de la institución. Podés ampliarla a partidos linderos desde el panel." error={errores.zona}>
          <Input
            name="zona"
            value={v.zona}
            onChange={(e) => set("zona", e.target.value)}
            maxLength={160}
            placeholder="Ej. Villa Adelina, Vicente López"
          />
        </Campo>

        <Campo etiqueta="Descripción" error={errores.descripcion}>
          <Textarea
            name="descripcion"
            value={v.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            maxLength={2000}
            className="min-h-[100px]"
            placeholder="Contá en qué consiste el cargo: grupos, horarios, responsabilidades…"
          />
        </Campo>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Campo etiqueta="Requisitos" ayuda="Uno por línea." error={errores.requisitos}>
            <Textarea
              name="requisitos"
              value={v.requisitos}
              onChange={(e) => set("requisitos", e.target.value)}
              maxLength={2000}
              placeholder={"Título docente vigente\nExperiencia en Primario"}
            />
          </Campo>
          <Campo etiqueta="Beneficios" ayuda="Uno por línea." error={errores.beneficios}>
            <Textarea
              name="beneficios"
              value={v.beneficios}
              onChange={(e) => set("beneficios", e.target.value)}
              maxLength={2000}
              placeholder={"Capacitación interna anual\nNatatorio propio"}
            />
          </Campo>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <Boton type="submit" variante="cta" tamano="lg" disabled={pendiente} aria-busy={pendiente}>
            {pendiente ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Publicar búsqueda"}
          </Boton>
          <Link href={cancelar} className="ml-1.5 text-[13px] font-medium text-sutil hover:text-tinta">
            Cancelar
          </Link>
          {estado && (
            <p role="alert" className="m-0 basis-full text-[13px] text-[#b91c1c]">
              {estado.error}
            </p>
          )}
        </div>
      </div>

      <PanelCoincidencias
        modo={modo}
        interruptores={interruptores}
        onInterruptor={(clave, valor) => setInterruptores((i) => ({ ...i, [clave]: valor }))}
        criterios={{
          categoria: v.categoria,
          disciplina: disciplinaFinal || undefined,
          nivel: v.nivel || undefined,
          turno: v.turno || undefined,
          zona: v.zona.trim() || undefined,
        }}
      />
    </form>
  );
}
