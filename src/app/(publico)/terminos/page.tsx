import { DocumentoLegal } from "@/components/publico/documento-legal";
import { SECCIONES_TERMINOS, TITULO_TERMINOS } from "@/lib/terminos-texto";
import { TERMINOS_ACTUALIZADOS, TERMINOS_NUMERO_DE_VERSION } from "@/lib/terminos";
import { metadatosDePagina, PAGINAS } from "@/lib/seo";

export const metadata = metadatosDePagina(PAGINAS.terminos);

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
