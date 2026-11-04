import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/publico/documento-legal";
import { SECCIONES_TERMINOS, TITULO_TERMINOS } from "@/lib/terminos-texto";
import { TERMINOS_ACTUALIZADOS, TERMINOS_NUMERO_DE_VERSION } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Términos y condiciones de uso y contratación de UNIDOAR: qué es la plataforma, el registro, las obligaciones de docentes e instituciones, los servicios pagos, la responsabilidad y la jurisdicción.",
};

export default function Terminos() {
  return (
    <DocumentoLegal
      titulo={TITULO_TERMINOS}
      actualizacion={TERMINOS_ACTUALIZADOS}
      version={TERMINOS_NUMERO_DE_VERSION}
      secciones={SECCIONES_TERMINOS}
      etiquetaDelIndice="Índice de los términos"
    />
  );
}
