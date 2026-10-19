import { botonClases } from "@/components/ui/button";
import { Icono } from "@/components/icons";

const ICONO = (
  <Icono nombre="whatsapp" tamano={16} trazo={1.8} />
);

/**
 * Abre una conversación de WhatsApp (wa.me) en otra pestaña. No manda nada solo: el texto llega prellenado y
 * lo envía la persona. Sin un teléfono argentino reconocible el botón queda deshabilitado y lo explica.
 */
export function BotonWhatsapp({
  href,
  children,
  motivoDeshabilitado = "No hay un teléfono de contacto válido cargado",
}: {
  href: string | null;
  children: React.ReactNode;
  motivoDeshabilitado?: string;
}) {
  const clases = botonClases({ variante: "secundario", bloque: true });
  if (!href) {
    return (
      <button type="button" disabled title={motivoDeshabilitado} className={clases}>
        {ICONO}
        {children}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={clases}>
      {ICONO}
      {children}
    </a>
  );
}
