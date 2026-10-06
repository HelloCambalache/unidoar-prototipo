import Link from "next/link";
import { cn } from "@/lib/utils";

/* Piezas chicas que se repiten en las pantallas del alta y del acceso. */

export function TituloPaso({
  titulo,
  bajada,
  grande,
  className,
}: {
  titulo: string;
  bajada?: React.ReactNode;
  /** 24 px en vez de 22 (pasos del docente). */
  grande?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-[22px]", className)}>
      <h1 className={cn("m-0 mb-2 leading-tight font-semibold tracking-[-0.018em]", grande ? "text-2xl" : "text-[22px]")}>{titulo}</h1>
      {bajada && <p className="m-0 text-sm leading-normal text-apagado">{bajada}</p>}
    </div>
  );
}

/** Subtítulo de una sección dentro de un paso ("¿Qué enseñás?") con su bajada. */
export function SeccionPaso({
  titulo,
  bajada,
  children,
  className,
}: {
  titulo: string;
  bajada?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6", className)}>
      <h2 className="m-0 mb-[5px] text-base leading-snug font-semibold">{titulo}</h2>
      {bajada && <p className="m-0 mb-3.5 text-[13.5px] leading-normal text-apagado">{bajada}</p>}
      {children}
    </section>
  );
}

export function AlertaError({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("rounded-lg bg-[#fee2e2] px-3.5 py-2.5 text-[13px] leading-snug text-[#991b1b]", className)}>
      {children}
    </p>
  );
}

export function AlertaAviso({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="status" className={cn("rounded-lg bg-verde-tint px-3.5 py-2.5 text-[13px] leading-snug text-verde", className)}>
      {children}
    </p>
  );
}

export function EnlaceVolver({ href, children = "← Volver" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-block text-[13px] leading-none font-medium text-sutil hover:text-tinta">
      {children}
    </Link>
  );
}

export function IconoGoogle() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" className="flex-none">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/** "───── o registrate con Google ─────" */
export function SeparadorConTexto({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-1.5 flex items-center gap-2.5 text-xs leading-none text-sutil" role="separator">
      <span className="h-px flex-1 bg-borde" />
      {children}
      <span className="h-px flex-1 bg-borde" />
    </div>
  );
}
