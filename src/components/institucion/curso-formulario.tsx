"use client";

import { useActionState, useState } from "react";
import { crearCurso, editarCurso } from "@/app/actions/cursos";
import { CursoHorario } from "@/components/institucion/curso-horario";
import { Boton, BotonLink } from "@/components/ui/button";
import { CampoDireccion } from "@/components/ui/campo-direccion";
import { Campo, Input, Textarea } from "@/components/ui/campos";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import {
  armarHorario,
  diasIniciales,
  franjaPorDefecto,
  MODALIDADES,
  recalcularDias,
  type DiasCurso,
  type Modalidad,
  type ValoresCurso,
} from "@/lib/cursos";
import { cn } from "@/lib/utils";

/**
 * Crear y editar un curso. Los campos son controlados: React 19 resetea los sin controlar cuando termina
 * una acción, y ante un error de validación no queremos perder lo escrito.
 */
export function CursoFormulario({
  modo,
  cursoId,
  inicial,
}: {
  modo: "crear" | "editar";
  cursoId?: string;
  inicial: ValoresCurso;
}) {
  const accion = modo === "editar" && cursoId ? editarCurso.bind(null, cursoId) : crearCurso;
  const [estado, formAction, pendiente] = useActionState(accion, null);
  const errores = estado?.campos ?? {};

  const [v, setV] = useState(inicial);
  const set = <K extends keyof ValoresCurso>(clave: K, valor: ValoresCurso[K]) =>
    setV((previo) => ({ ...previo, [clave]: valor }));

  const [dias, setDias] = useState<DiasCurso>(() => diasIniciales(inicial.fechaInicio, inicial.fechaFinal, inicial.horario));
  // Lo que la grilla arma con los datos con los que abrió el formulario: mientras no se toque, se conserva el texto original.
  const [horarioDeArranque] = useState(() => armarHorario(diasIniciales(inicial.fechaInicio, inicial.fechaFinal, inicial.horario)));

  const cambiarFecha = (campo: "fechaInicio" | "fechaFinal", valor: string) => {
    set(campo, valor);
    const inicio = campo === "fechaInicio" ? valor : v.fechaInicio;
    const fin = campo === "fechaFinal" ? valor : v.fechaFinal;
    setDias((previos) => recalcularDias(inicio, fin, previos, franjaPorDefecto(inicial.horario)));
  };

  // Con días armados el horario sale de la grilla; sin fechas se conserva el texto que ya tenía el curso.
  const hayDias = Object.keys(dias).length > 0;
  const hayActivos = Object.values(dias).some((d) => d?.activo);
  const armado = armarHorario(dias);
  const horario = hayDias ? (hayActivos ? (armado === horarioDeArranque && inicial.horario ? inicial.horario : armado) : "") : inicial.horario;

  const cancelar = modo === "editar" && cursoId ? `/institucion/cursos/${cursoId}` : "/institucion/cursos";

  return (
    <form action={formAction} className="flex max-w-[900px] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <SubirArchivo
          bucket="publico"
          carpeta="cursos"
          nombre="fotoUrl"
          etiqueta="Foto del curso"
          variante="banner"
          valorInicial={inicial.fotoUrl}
          className="[&>button]:h-[170px]"
        />
        {errores.fotoUrl && (
          <span role="alert" className="text-xs text-[#b91c1c]">
            {errores.fotoUrl}
          </span>
        )}
      </div>

      <Campo etiqueta="Título" requerido error={errores.titulo}>
        <Input
          name="titulo"
          value={v.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          maxLength={120}
          required
          aria-invalid={!!errores.titulo}
          placeholder="Ej. Curso de RCP y primeros auxilios"
        />
      </Campo>

      <Campo etiqueta="Subtítulo" error={errores.subtitulo}>
        <Input
          name="subtitulo"
          value={v.subtitulo}
          onChange={(e) => set("subtitulo", e.target.value)}
          maxLength={160}
          aria-invalid={!!errores.subtitulo}
          placeholder="Ej. Certificación con Cruz Roja"
        />
      </Campo>

      <Campo etiqueta="Descripción" error={errores.descripcion}>
        <Textarea
          name="descripcion"
          value={v.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          maxLength={2000}
          className="min-h-[90px]"
          aria-invalid={!!errores.descripcion}
          placeholder="Contá de qué se trata el curso"
        />
      </Campo>

      <div className="flex flex-col gap-1.5">
        <span id="etiqueta-modalidad" className="text-xs font-semibold text-apagado">
          Modalidad
        </span>
        <input type="hidden" name="modalidad" value={v.modalidad} />
        <div role="radiogroup" aria-labelledby="etiqueta-modalidad" className="flex gap-2">
          {MODALIDADES.map((m) => (
            <BotonModalidad key={m} modalidad={m} activa={v.modalidad === m} onElegir={() => set("modalidad", m)} />
          ))}
        </div>
        {errores.modalidad && (
          <span role="alert" className="text-xs text-[#b91c1c]">
            {errores.modalidad}
          </span>
        )}
      </div>

      <Campo etiqueta="Profesor que lo dicta" error={errores.profesor}>
        <Input
          name="profesor"
          value={v.profesor}
          onChange={(e) => set("profesor", e.target.value)}
          maxLength={120}
          aria-invalid={!!errores.profesor}
          placeholder="Ej. Martina Alsina"
        />
      </Campo>

      <div className="rounded-tarjeta border border-linea bg-white px-[18px] py-4">
        <input type="hidden" name="certifica" value={v.certifica ? "on" : ""} />
        <button
          type="button"
          role="switch"
          aria-checked={v.certifica}
          onClick={() => set("certifica", !v.certifica)}
          className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-sm leading-[1.3] font-semibold text-tinta">Entrega certificado</span>
            <span className="block text-[12.5px] leading-[1.4] text-apagado">
              Al terminarlo, el profesional recibe el certificado y el curso le suma puntaje.
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              "relative h-[22px] w-[38px] flex-none rounded-full transition-colors duration-[180ms]",
              v.certifica ? "bg-verde" : "bg-[#CFCCC5]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-[18px] rounded-full bg-white transition-[left,right] duration-[180ms]",
                v.certifica ? "right-0.5" : "left-0.5",
              )}
            />
          </span>
        </button>
        {v.certifica ? (
          <div className="mt-3.5 max-w-[220px] border-t border-[#F0EFEA] pt-3.5">
            <Campo etiqueta="Puntaje que suma" error={errores.puntaje}>
              <Input
                type="number"
                name="puntaje"
                min={0}
                max={100}
                step={1}
                value={v.puntaje}
                onChange={(e) => set("puntaje", e.target.value)}
                aria-invalid={!!errores.puntaje}
              />
            </Campo>
          </div>
        ) : (
          <p className="m-0 mt-3 text-[12.5px] leading-[1.4] text-sutil">
            Sin certificado, el curso aparece igual en el catálogo pero no suma puntaje.
          </p>
        )}
      </div>

      <div className="flex gap-3.5 max-[560px]:flex-col">
        <Campo etiqueta="Fecha de inicio" error={errores.fechaInicio} className="flex-1">
          <Input
            type="date"
            name="fechaInicio"
            value={v.fechaInicio}
            onChange={(e) => cambiarFecha("fechaInicio", e.target.value)}
            aria-invalid={!!errores.fechaInicio}
          />
        </Campo>
        <Campo etiqueta="Fecha de finalización" error={errores.fechaFinal} className="flex-1">
          <Input
            type="date"
            name="fechaFinal"
            value={v.fechaFinal}
            min={v.fechaInicio || undefined}
            onChange={(e) => cambiarFecha("fechaFinal", e.target.value)}
            aria-invalid={!!errores.fechaFinal}
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-apagado">Horario</span>
        <input type="hidden" name="horario" value={horario} />
        <CursoHorario dias={dias} onCambio={setDias} horarioGuardado={inicial.horario} resumen={horario} />
        {errores.horario && (
          <span role="alert" className="text-xs text-[#b91c1c]">
            {errores.horario}
          </span>
        )}
      </div>

      {v.modalidad === "Presencial" ? (
        <CampoDireccion
          proposito="curso"
          etiqueta="Dónde se dicta"
          requerido
          required
          defaultValue={v.direccion}
          onCambioTexto={(t) => set("direccion", t)}
          ayuda="Escribí calle, número y localidad: es lo que ven los profesionales al inscribirse, y con eso mostramos a cuántos km queda."
          error={errores.direccion}
        />
      ) : (
        <>
          <Campo
            etiqueta="Link para conectarse"
            ayuda="Lo ven los profesionales que se inscriben."
            error={errores.link}
          >
            <Input
              name="link"
              inputMode="url"
              autoComplete="off"
              value={v.link}
              onChange={(e) => set("link", e.target.value)}
              maxLength={500}
              aria-invalid={!!errores.link}
              placeholder="Ej. https://meet.google.com/..."
            />
          </Campo>
          <Campo
            etiqueta="Contraseña o código de acceso (opcional)"
            ayuda="Si la sala lo pide (por ejemplo, en Zoom), lo ven junto al link los profesionales que se inscriben."
            error={errores.linkClave}
          >
            <Input
              name="linkClave"
              autoComplete="off"
              value={v.linkClave}
              onChange={(e) => set("linkClave", e.target.value)}
              maxLength={100}
              aria-invalid={!!errores.linkClave}
              placeholder="Ej. 482915"
            />
          </Campo>
        </>
      )}

      {/*
        Pendiente (sin columna en `cursos` todavía): "Material adjunto" (cursoModalArchivos), "Más fotos del curso"
        (galería) y "Link de inscripción o más información" (linkInfo) del prototipo.
      */}

      <div className="mt-1.5 flex flex-col gap-2.5">
        {estado && (
          <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
            {estado.error}
          </p>
        )}
        <div className="flex gap-2.5 max-[560px]:flex-col-reverse">
          <BotonLink href={cancelar} variante="secundario" className="flex-1">
            Cancelar
          </BotonLink>
          <Boton type="submit" variante="cta" className="flex-1" disabled={pendiente} aria-busy={pendiente}>
            {pendiente ? "Guardando…" : "Guardar curso"}
          </Boton>
        </div>
      </div>
    </form>
  );
}

function BotonModalidad({
  modalidad,
  activa,
  onElegir,
}: {
  modalidad: Modalidad;
  activa: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onElegir}
      className={cn(
        "min-h-[46px] flex-1 rounded-lg px-2.5 text-center text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
        activa ? "bg-navy-700 text-white" : "bg-[#F0EFEA] text-apagado hover:bg-[#E6E4DE] hover:text-tinta",
      )}
    >
      {modalidad}
    </button>
  );
}
