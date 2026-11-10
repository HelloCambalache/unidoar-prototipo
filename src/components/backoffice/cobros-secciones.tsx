import { Pestanas } from "@/components/ui/pestanas";

/**
 * Las dos vistas de Cobros: «Por institución» (el estado de cada cuenta y su próximo cobro) y «Pagos» (el reporte de todo lo que entró, con el método
 * de pago de cada uno). Va arriba de las dos pantallas para poder pasar de una a la otra.
 */
export function CobrosSecciones({ activa }: { activa: "instituciones" | "pagos" }) {
  return (
    <Pestanas
      className="mb-5"
      activa={activa}
      items={[
        { clave: "instituciones", etiqueta: "Por institución", href: "/backoffice/cobros" },
        { clave: "pagos", etiqueta: "Pagos (reporte)", href: "/backoffice/cobros/pagos" },
      ]}
    />
  );
}
