import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoCategoria } from "@/components/onboarding/paso-categoria";
import { docenteDeUsuario, usuarioParaAlta } from "@/lib/alta";
import { RUTA_INICIO } from "@/lib/catalogo";
import { ID_FORMULARIO_ONBOARDING, PASOS_DOCENTE } from "@/lib/onboarding";
import { catalogoAsignaturas, detalleDeDocente } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "¿Qué sos?" };

/**
 * "¿Qué sos?": primer paso con sesión del docente. Acá se crea la fila `usuarios` con rol "docente"
 * (y, al continuar, su perfil). Si ya hay perfil se precarga; si el alta ya terminó, va al dashboard.
 */
export default async function PasoDocenteCategoria() {
  const usuario = await usuarioParaAlta("docente");
  const docente = await docenteDeUsuario(usuario.id);
  if (docente?.onboardingCompleto) redirect(RUTA_INICIO.docente);

  const [catalogo, detalle] = await Promise.all([catalogoAsignaturas(), docente ? detalleDeDocente(docente.id) : null]);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE.categoria} formId={ID_FORMULARIO_ONBOARDING}>
      <PasoCategoria
        catalogo={catalogo}
        inicial={{
          categoria: docente?.categoria ?? "educador",
          asignaturas: docente?.asignaturas ?? [],
          estudio: detalle?.situacionEstudio === "estudiante" ? "estudiante" : "recibido",
          porcentaje: detalle?.porcentajeMaterias != null ? String(detalle.porcentajeMaterias) : "",
        }}
      />
    </MarcoOnboarding>
  );
}
