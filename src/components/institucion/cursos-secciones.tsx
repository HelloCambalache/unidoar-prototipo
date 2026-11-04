import { Pestanas } from "@/components/ui/pestanas";

/**
 * Las dos partes de Cursos de una institución: lo que ella ofrece y lo que ofrecen las demás (donde puede anotarse). Pestañas como
 * links, así cada una tiene su dirección y funciona sin JavaScript.
 */
export function CursosSecciones({ activa }: { activa: "mios" | "explorar" }) {
  return (
    <Pestanas
      className="mb-5"
      activa={activa}
      items={[
        { clave: "mios", etiqueta: "Mis cursos", href: "/institucion/cursos" },
        { clave: "explorar", etiqueta: "Explorar cursos", href: "/institucion/cursos/explorar" },
      ]}
    />
  );
}
