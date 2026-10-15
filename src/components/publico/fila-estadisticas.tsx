import { Icono, type IconoClave } from "@/components/icons";

export type Estadistica = {
  valor: string;
  etiqueta: string;
  /** Color de la cifra, de la barrita y del ícono (hex de 6 dígitos). */
  color: string;
  icono: IconoClave;
};

/** Fila de cifras centradas con ícono, barrita y descripción (se apila por debajo de 640px). */
export function FilaEstadisticas({ items }: { items: Estadistica[] }) {
  return (
    <section aria-label="Cifras de UNIDOAR" className="bg-lienzo px-12 pb-4 max-[900px]:px-6">
      <ul className="m-0 mx-auto grid max-w-[1200px] list-none grid-cols-4 gap-4 p-0 max-[900px]:grid-cols-2 max-[480px]:gap-3">
        {items.map((i) => (
          <li key={i.etiqueta} className="flex flex-col items-start rounded-tarjeta bg-white px-6 py-6 shadow-tarjeta max-[480px]:px-4 max-[480px]:py-4">
            <div
              style={{ background: `${i.color}1a`, color: i.color }}
              className="mb-4 flex size-11 items-center justify-center rounded-[14px]"
            >
              <Icono nombre={i.icono} tamano={20} trazo={2} />
            </div>
            <div className="font-display text-[40px] max-[480px]:text-[30px] leading-none font-semibold tracking-[-0.03em] text-navy-900">{i.valor}</div>
            <p className="m-0 mt-2 text-sm leading-normal text-apagado">{i.etiqueta}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
