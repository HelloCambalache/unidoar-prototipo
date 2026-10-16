import { focoDeFoto } from "@/lib/fotos";
import { cn } from "@/lib/utils";

/** Foto del curso a todo el ancho; sin foto, el recuadro gris con el ícono de imagen del prototipo. */
export function CursoFoto({
  url,
  altura,
  className,
  redondeada,
}: {
  url?: string | null;
  altura: number;
  className?: string;
  redondeada?: boolean;
}) {
  const estilo = { height: altura };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fotos subidas por las instituciones, de tamaños libres
      <img
        src={url}
        alt=""
        style={{ ...estilo, objectPosition: focoDeFoto(url) }}
        className={cn("block w-full object-cover", redondeada && "rounded-interno", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={estilo}
      className={cn("flex w-full items-center justify-center bg-[#F3F2EE] text-[#C9C6C0]", redondeada && "rounded-interno", className)}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M4 17l5-5 4 4 3-2 4 4" />
      </svg>
    </div>
  );
}
