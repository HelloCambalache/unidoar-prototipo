import { botonClases } from "@/components/ui/button";

const ICONO = (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-none">
    <path d="M21 11.5a8.4 8.4 0 01-12.4 7.4L3 20.5l1.6-5.4A8.4 8.4 0 1121 11.5z" />
  </svg>
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
