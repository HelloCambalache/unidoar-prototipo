import type { Docente } from "@/db/schema";

/** Lo que mira `pendientesDePerfil`: alcanza con estas columnas (el backoffice no trae la fila entera de cada docente). */
export type DatosDePerfil = Pick<
  Docente,
  | "fotoUrl"
  | "resumen"
  | "telefono"
  | "zonas"
  | "asignaturas"
  | "disponibilidad"
  | "niveles"
  | "experiencia"
  | "formacion"
  | "cvUrl"
  | "verificacion"
>;

/**
 * Qué falta completar en el perfil de un docente. El porcentaje sale de acá, así
 * el chip "Perfil 80%" del header y la lista de pendientes no pueden desfasarse.
 */
export function pendientesDePerfil(d: DatosDePerfil) {
  const pasos: { clave: string; etiqueta: string; ok: boolean }[] = [
    { clave: "foto", etiqueta: "Subir una foto de perfil", ok: !!d.fotoUrl },
    { clave: "resumen", etiqueta: "Escribir un resumen sobre vos", ok: !!d.resumen?.trim() },
    { clave: "telefono", etiqueta: "Dejar un teléfono de contacto", ok: !!d.telefono },
    { clave: "zonas", etiqueta: "Elegir las zonas donde trabajás", ok: d.zonas.length > 0 },
    { clave: "asignaturas", etiqueta: "Indicar tus asignaturas o disciplinas", ok: d.asignaturas.length > 0 },
    { clave: "disponibilidad", etiqueta: "Marcar tu disponibilidad", ok: d.disponibilidad.length > 0 },
    { clave: "niveles", etiqueta: "Elegir los niveles en los que enseñás", ok: d.niveles.length > 0 },
    { clave: "experiencia", etiqueta: "Sumar tu experiencia", ok: d.experiencia.length > 0 },
    { clave: "formacion", etiqueta: "Sumar tu formación", ok: d.formacion.length > 0 },
    { clave: "cv", etiqueta: "Subir tu CV", ok: !!d.cvUrl },
    { clave: "verificacion", etiqueta: "Verificar tu identidad y título", ok: d.verificacion === "verificado" },
  ];
  const hechos = pasos.filter((p) => p.ok).length;
  return { pasos, pendientes: pasos.filter((p) => !p.ok), porcentaje: Math.round((hechos / pasos.length) * 100) };
}
