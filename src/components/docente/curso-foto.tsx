import { focoDeFoto } from "@/lib/fotos";
import { cn } from "@/lib/utils";
import { Icono } from "@/components/icons";

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
      <Icono nombre="imagen" tamano={24} trazo={1.5} />
    </div>
  );
}
