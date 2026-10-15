"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearBusqueda, editarBusqueda } from "@/app/actions/busquedas";
import { Icono } from "@/components/icons";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { PanelCoincidencias, type Interruptores } from "@/components/institucion/panel-coincidencias";
import type { CategoriaDocente } from "@/db/schema";
import { OPCIONES_VENCIMIENTO } from "@/lib/busquedas";
import { CATEGORIA_INFO, CATEGORIAS, NIVELES, TIPOS_BUSQUEDA, TURNOS } from "@/lib/catalogo";
import { sugerirDescripcion, sugerirPuesto, sugerirRequisitos, type DatosParaRedactar } from "@/lib/redaccion-busqueda";
import { cn } from "@/lib/utils";

export type ValoresFormulario = {
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: (typeof NIVELES)[number] | "";
  tipo: (typeof TIPOS_BUSQUEDA)[number];
  cargaHoraria: string;
  turno: (typeof TURNOS)[number] | "";
  fechaInicio: string;
  /** En qué sede es la búsqueda (vacío si la institución todavía no tiene ninguna guardada). */
  sedeId: string;
  zona: string;
  descripcion: string;
  requisitos: string;
  beneficios: string;
};

/** Una sede para elegir al publicar: su zona se usa como zona de la búsqueda. */
export type SedeParaElegir = { id: string; nombre: string; zona: string };

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
  sedes,
  plazoActual,
}: {
  modo: "crear" | "editar";
  busquedaId?: string;
  inicial: ValoresFormulario;
  catalogo: CatalogoDisciplinas;
  /** Las sedes de la institución; con una sola no se pregunta en cuál es. */
  sedes: SedeParaElegir[];
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

  // Al cambiar de sede, la zona se actualiza sola si estaba vacía o era la de la sede anterior (si la persona la ajustó, se respeta).
  const cambiarSede = (sedeId: string) =>
    setV((previo) => {
      const anterior = sedes.find((s) => s.id === previo.sedeId);
      const nueva = sedes.find((s) => s.id === sedeId);
      const acompaniar = !previo.zona.trim() || previo.zona === (anterior?.zona ?? "");
      return { ...previo, sedeId, zona: acompaniar && nueva ? nueva.zona : previo.zona };
    });

  const esRapida = v.tipo === "Suplencia rápida";
  // El tipo al que vuelve la búsqueda si se desmarca "urgente" (el que tenía antes, o Suplencia).
  const [tipoComun, setTipoComun] = useState<ValoresFormulario["tipo"]>(
    inicial.tipo === "Suplencia rápida" ? "Suplencia" : inicial.tipo,
  );
  // Lo que ya completó la institución: de ahí salen las sugerencias de título, descripción y requisitos.
  const paraRedactar: DatosParaRedactar = {
    categoria: v.categoria,
    disciplina: disciplinaFinal,
    nivel: v.nivel,
    tipo: v.tipo,
    cargaHoraria: v.cargaHoraria,
    turno: v.turno,
    fechaInicio: v.fechaInicio,
    zona: v.zona,
  };
  const sinDisciplina = !disciplinaFinal;
  const cancelar = modo === "editar" && busquedaId ? `/institucion/postulantes?busqueda=${busquedaId}` : "/institucion/busquedas";

  return (
    <form
      action={formAction}
      className="flex items-start gap-6 max-[1000px]:flex-wrap max-[860px]:flex-col max-[860px]:gap-4"
    >
      <div className="flex w-full max-w-[980px] min-w-0 flex-1 flex-col gap-4 rounded-ud border border-borde bg-white p-6 max-[560px]:p-4">
        {/* Común o urgente: a la vista, arriba de todo. Urgente es el tipo "Suplencia rápida". */}
        <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0 max-[640px]:grid-cols-1">
          <legend className="mb-2 p-0 text-[13px] font-semibold text-tinta">¿Qué tipo de búsqueda es?</legend>
          <button
            type="button"
            aria-pressed={!esRapida}
            onClick={() => esRapida && set("tipo", tipoComun)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-[18px] border-[1.5px] p-4 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
              !esRapida ? "border-navy-700 bg-navy-50" : "border-borde bg-white hover:border-borde-fuerte",
            )}
          >
            <span className="text-[15px] font-semibold text-tinta">Búsqueda común</span>
            <span className="text-[13px] leading-snug text-apagado">Titular, suplencia, temporada o freelance. Recibe postulaciones hasta que la cierres.</span>
          </button>
          <button
            type="button"
            aria-pressed={esRapida}
            onClick={() => {
              if (esRapida) return;
              setTipoComun(v.tipo);
              set("tipo", "Suplencia rápida");
            }}
            className={cn(
              "flex flex-col items-start gap-1 rounded-[18px] border-[1.5px] p-4 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-naranja/40 focus-visible:outline-none",
              esRapida ? "border-naranja bg-naranja-tint" : "border-borde bg-white hover:border-naranja/60",
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-naranja-ink">
              <Icono nombre="rayo" tamano={15} trazo={2} />
              Búsqueda urgente
            </span>
            <span className="text-[13px] leading-snug text-apagado">
              Para cubrir rápido: avisamos al momento a los profesionales que encajan y vence en el plazo que elijas.
            </span>
          </button>
        </fieldset>

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
        {!v.puesto.trim() && (
          <BotonSugerir deshabilitado={sinDisciplina} onClick={() => set("puesto", sugerirPuesto(paraRedactar))}>
            Sugerir título
          </BotonSugerir>
        )}

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
          {esRapida ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-tinta">Tipo</span>
              <input type="hidden" name="tipo" value={v.tipo} />
              <span className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-naranja-tint px-3.5 text-[14px] font-semibold text-naranja-ink">
                <Icono nombre="rayo" tamano={15} trazo={2} />
                Suplencia rápida
              </span>
            </div>
          ) : (
            <Campo etiqueta="Tipo" requerido error={errores.tipo}>
              <Select name="tipo" value={v.tipo} onChange={(e) => set("tipo", e.target.value as ValoresFormulario["tipo"])}>
                {/* La urgente se elige arriba ("Búsqueda urgente"), no acá. */}
                {TIPOS_BUSQUEDA.filter((t) => t !== "Suplencia rápida").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
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

        {sedes.length > 1 ? (
          <Campo etiqueta="Sede" requerido ayuda="Los kilómetros que ven los profesionales se miden hasta esta sede." error={errores.sedeId}>
            <Select name="sedeId" value={v.sedeId} onChange={(e) => cambiarSede(e.target.value)} aria-invalid={!!errores.sedeId}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.zona ? `${s.nombre} · ${s.zona}` : s.nombre}
                </option>
              ))}
            </Select>
          </Campo>
        ) : (
          <input type="hidden" name="sedeId" value={v.sedeId} />
        )}

        <Campo etiqueta="Zona" ayuda={sedes.length > 1 ? "Tomada de la sede. Podés ampliarla a partidos linderos desde el panel." : "Tomada del perfil de la institución. Podés ampliarla a partidos linderos desde el panel."} error={errores.zona}>
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
        {!v.descripcion.trim() && (
          <BotonSugerir deshabilitado={sinDisciplina} onClick={() => set("descripcion", sugerirDescripcion(paraRedactar))}>
            Sugerir descripción con lo que ya completaste
          </BotonSugerir>
        )}

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <div className="flex flex-col gap-2">
            <Campo etiqueta="Requisitos" ayuda="Uno por línea." error={errores.requisitos}>
              <Textarea
                name="requisitos"
                value={v.requisitos}
                onChange={(e) => set("requisitos", e.target.value)}
                maxLength={2000}
                placeholder={"Título profesional vigente\nExperiencia en Primario"}
              />
            </Campo>
            {!v.requisitos.trim() && (
              <BotonSugerir deshabilitado={sinDisciplina} onClick={() => set("requisitos", sugerirRequisitos(paraRedactar))}>
                Sugerir requisitos habituales
              </BotonSugerir>
            )}
          </div>
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

/**
 * "Sugerir …": completa un campo vacío con una plantilla armada con lo que ya se cargó (no hay ningún modelo detrás y no se
 * inventa nada). Solo aparece mientras el campo está vacío; se edita como cualquier texto.
 */
function BotonSugerir({ deshabilitado, onClick, children }: { deshabilitado: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="-mt-2 flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={deshabilitado}
        className="flex w-max cursor-pointer items-center gap-1.5 rounded text-[12.5px] leading-none font-semibold text-navy-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
      >
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5l1.7 4.6 4.6 1.7-4.6 1.7L12 15.1l-1.7-4.6-4.6-1.7 4.6-1.7z" />
        </svg>
        {children}
      </button>
      {deshabilitado && <span className="text-[11.5px] leading-none text-sutil">Elegí primero la disciplina.</span>}
    </div>
  );
}
