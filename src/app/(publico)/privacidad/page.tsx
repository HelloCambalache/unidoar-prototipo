import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/publico/documento-legal";
import { SECCIONES_PRIVACIDAD, TITULO_PRIVACIDAD } from "@/lib/privacidad-texto";
import { PRIVACIDAD_ACTUALIZADA, PRIVACIDAD_NUMERO_DE_VERSION } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Política de privacidad y protección de datos personales de UNIDOAR: quién es el responsable, qué datos se recopilan, para qué se usan, quién puede verlos y cómo ejercer tus derechos.",
};

/*
 * El texto es el documento legal de la titular, cargado tal cual (src/lib/privacidad-texto.ts). Ya no lo escribimos nosotros a partir de lo que hace
 * la app: si la app cambia lo que hace con los datos, hay que avisarle a quien redacta el documento para que lo actualice.
 */
export default function Privacidad() {
  return (
    <DocumentoLegal
      titulo={TITULO_PRIVACIDAD}
      actualizacion={PRIVACIDAD_ACTUALIZADA}
      version={PRIVACIDAD_NUMERO_DE_VERSION}
      secciones={SECCIONES_PRIVACIDAD}
      etiquetaDelIndice="Índice de la política"
    />
  );
}
