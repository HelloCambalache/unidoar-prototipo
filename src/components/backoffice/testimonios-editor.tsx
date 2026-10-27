"use client";

import { useState, useTransition } from "react";
import { cambiarVisibilidadDeTestimonio, eliminarTestimonio, guardarTestimonio } from "@/app/actions/backoffice-testimonios";
import { Icono } from "@/components/icons";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { TestimonioFila } from "@/lib/queries/backoffice-testimonios";
import { LARGO_DE_CITA, MAX_TESTIMONIOS_POR_PAGINA, PAGINAS_DE_TESTIMONIOS, type PaginaDeTestimonio } from "@/lib/testimonios";
import { iniciales } from "@/lib/utils";

/** Texto de un botón de acción de fila. */
const BOTON_FILA =
  "rounded-md px-1.5 py-1 text-[13px] leading-none font-medium text-apagado transition-colors hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:opacity-50";

type Formulario = { id: string | null; pagina: PaginaDeTestimonio; cita: string; autor: string; cargo: string; fotoUrl: string };

const VACIO = (pagina: PaginaDeTestimonio): Formulario => ({ id: null, pagina, cita: "", autor: "", cargo: "", fotoUrl: "" });

/**
 * Testimonios de la portada y de las landings de categoría: agregar, editar, ocultar (sin borrar) y eliminar. Están agrupados por la página donde se
 * muestran; los ocultos no se ven en el sitio. Ordenados como se muestran (los nuevos van al final de su página).
 */
export function TestimoniosEditor({ testimonios, almacenamientoDisponible }: { testimonios: TestimonioFila[]; almacenamientoDisponible: boolean }) {
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();
  const [formulario, setFormulario] = useState<Formulario | null>(null);

  const visibles = testimonios.filter((t) => t.visible).length;

  const cambiarVisibilidad = (t: TestimonioFila) =>
    empezar(async () => {
      try {
        const r = await cambiarVisibilidadDeTestimonio(t.id, !t.visible);
        toast(r.ok ? (t.visible ? "Testimonio oculto" : "Testimonio visible en el sitio") : r.error, r.ok ? undefined : "error");
      } catch {
        toast("No pudimos hacer el cambio. Probá de nuevo.", "error");
      }
    });

  const eliminar = async (t: TestimonioFila) => {
    const confirmado = await pedirConfirmacion(
      `¿Eliminar el testimonio de ${t.autor}? Se borra para siempre, con su foto. Si solo querés sacarlo del sitio, ocultalo.`,
    );
    if (!confirmado) return;
    empezar(async () => {
      try {
        const r = await eliminarTestimonio(t.id);
        toast(r.ok ? "Testimonio eliminado" : r.error, r.ok ? undefined : "error");
      } catch {
        toast("No pudimos eliminar el testimonio. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] text-apagado" role="status">
          {testimonios.length === 0
            ? "Todavía no hay testimonios."
            : `${visibles} ${visibles === 1 ? "visible" : "visibles"} en el sitio · ${testimonios.length - visibles} ${testimonios.length - visibles === 1 ? "oculto" : "ocultos"}`}
        </p>
        <Boton onClick={() => setFormulario(VACIO("home"))}>
          <Icono nombre="mas" tamano={16} />
          Agregar testimonio
        </Boton>
      </div>

      {PAGINAS_DE_TESTIMONIOS.map((pagina) => {
        const lista = testimonios.filter((t) => t.pagina === pagina.clave);
        const cuantosVisibles = lista.filter((t) => t.visible).length;
        return (
          <Tarjeta como="section" key={pagina.clave} aria-labelledby={`testimonios-${pagina.clave}`} className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-5 py-3.5">
              <div className="flex items-baseline gap-2.5">
                <h2 id={`testimonios-${pagina.clave}`} className="m-0 text-[16px] leading-tight font-semibold">
                  {pagina.etiqueta}
                </h2>
                <span className="text-xs text-sutil">
                  {cuantosVisibles} de {lista.length} visibles
                </span>
              </div>
              <button type="button" onClick={() => setFormulario(VACIO(pagina.clave))} className={BOTON_FILA}>
                + Agregar acá
              </button>
            </div>

            {lista.length === 0 ? (
              <p className="m-0 px-5 py-6 text-[13px] leading-normal text-apagado">
                Sin testimonios: la sección no se muestra en esta página del sitio.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {lista.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start gap-3.5 border-b border-[#F0EFEA] px-5 py-4 last:border-b-0">
                    <Avatar iniciales={iniciales(t.autor)} fotoUrl={t.fotoUrl} tamano={44} />
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm leading-tight font-semibold text-tinta">{t.autor}</span>
                        <Insignia tono={t.visible ? "verde" : "neutro"}>{t.visible ? "Visible" : "Oculto"}</Insignia>
                      </div>
                      <div className="mb-1.5 text-[12.5px] leading-snug text-sutil">{t.cargo}</div>
                      <p className="m-0 line-clamp-2 text-[13.5px] leading-normal text-tinta-2">“{t.cita}”</p>
                    </div>
                    <div className="flex flex-none flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className={BOTON_FILA}
                        onClick={() => setFormulario({ id: t.id, pagina: t.pagina as PaginaDeTestimonio, cita: t.cita, autor: t.autor, cargo: t.cargo, fotoUrl: t.fotoUrl ?? "" })}
                      >
                        Editar
                      </button>
                      <button type="button" className={BOTON_FILA} disabled={pendiente} onClick={() => cambiarVisibilidad(t)}>
                        {t.visible ? "Ocultar" : "Mostrar"}
                      </button>
                      <button type="button" className={BOTON_FILA} disabled={pendiente} onClick={() => eliminar(t)}>
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        );
      })}

      <p className="m-0 text-[12.5px] leading-normal text-sutil">
        Cargá solo testimonios de personas que aceptaron que se publiquen con su nombre y su foto. Un testimonio oculto no se ve en el sitio pero se
        conserva para volver a mostrarlo; eliminarlo lo borra para siempre. Cada página admite hasta {MAX_TESTIMONIOS_POR_PAGINA} testimonios (los
        ocultos también cuentan) y la sección no se dibuja si no hay ninguno visible.
      </p>

      <DialogoModal
        abierto={formulario !== null}
        onCerrar={() => setFormulario(null)}
        titulo={formulario?.id ? "Editar testimonio" : "Agregar testimonio"}
        ancho={560}
      >
        {formulario && (
          <FormularioDeTestimonio
            key={formulario.id ?? "nuevo"}
            inicial={formulario}
            almacenamientoDisponible={almacenamientoDisponible}
            alTerminar={() => setFormulario(null)}
          />
        )}
      </DialogoModal>
    </div>
  );
}

function FormularioDeTestimonio({
  inicial,
  almacenamientoDisponible,
  alTerminar,
}: {
  inicial: Formulario;
  almacenamientoDisponible: boolean;
  alTerminar: () => void;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [pagina, setPagina] = useState<PaginaDeTestimonio>(inicial.pagina);
  const [cita, setCita] = useState(inicial.cita);
  const [autor, setAutor] = useState(inicial.autor);
  const [cargo, setCargo] = useState(inicial.cargo);
  const [fotoUrl, setFotoUrl] = useState(inicial.fotoUrl);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrores({});
    empezar(async () => {
      try {
        const r = await guardarTestimonio(inicial.id, { pagina, cita, autor, cargo, fotoUrl: fotoUrl || null });
        if (!r.ok) {
          setErrores(r.campos ?? {});
          toast(r.error, "error");
          return;
        }
        toast(inicial.id ? "Testimonio guardado" : "Testimonio agregado");
        alTerminar();
      } catch {
        toast("No pudimos guardar el testimonio. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <form onSubmit={guardar} className="mt-3 flex flex-col gap-4">
      <Campo etiqueta="Dónde se muestra" error={errores.pagina} requerido>
        <Select value={pagina} onChange={(e) => setPagina(e.target.value as PaginaDeTestimonio)} aria-invalid={Boolean(errores.pagina)}>
          {PAGINAS_DE_TESTIMONIOS.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.etiqueta}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo
        etiqueta="Testimonio"
        error={errores.cita}
        ayuda={`${cita.trim().length} de ${LARGO_DE_CITA.max} caracteres. Sin comillas: el sitio las pone.`}
        requerido
      >
        <Textarea
          value={cita}
          onChange={(e) => setCita(e.target.value)}
          maxLength={LARGO_DE_CITA.max + 40}
          rows={4}
          placeholder="Cubrimos una licencia en dos días. Antes tardábamos semanas."
          aria-invalid={Boolean(errores.cita)}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
        <Campo etiqueta="Nombre" error={errores.autor} requerido>
          <Input value={autor} onChange={(e) => setAutor(e.target.value)} maxLength={80} placeholder="Marina Costa" aria-invalid={Boolean(errores.autor)} />
        </Campo>
        <Campo etiqueta="Cargo e institución" error={errores.cargo} requerido>
          <Input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            maxLength={120}
            placeholder="Vicedirectora · Colegio San Andrés"
            aria-invalid={Boolean(errores.cargo)}
          />
        </Campo>
      </div>

      <div>
        <SubirArchivo
          bucket="publico"
          carpeta="fotos"
          nombre="fotoUrl"
          etiqueta="Foto (opcional)"
          variante="circulo"
          valorInicial={inicial.fotoUrl || null}
          disponible={almacenamientoDisponible}
          onCambio={(valor) => setFotoUrl(valor)}
          ayuda="Sin foto se muestran las iniciales."
        />
        {errores.fotoUrl && (
          <p role="alert" className="mt-1 text-xs text-[#b91c1c]">
            {errores.fotoUrl}
          </p>
        )}
      </div>

      <div className="mt-1 flex justify-end gap-2.5">
        <Boton type="button" variante="secundario" onClick={alTerminar} disabled={pendiente}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : inicial.id ? "Guardar cambios" : "Agregar testimonio"}
        </Boton>
      </div>
    </form>
  );
}
