import type { DocumentoBo } from "@/lib/backoffice-docentes";
import { cn } from "@/lib/utils";
import { Icono } from "@/components/icons";

/**
 * Un documento de la cola de verificación: vista previa si es una imagen, ícono si es un PDF, y el enlace
 * firmado (vence a los 15 minutos) para abrirlo en otra pestaña. Si falta, dice si bloquea o es optativo.
 */
export function VerifDocumento({ d }: { d: DocumentoBo }) {
  const abrir = d.url ? `Abrir ${d.etiqueta} en una pestaña nueva` : undefined;

  const estado = d.subido ? (
    d.url ? (
      <span className="text-verde">Cargado</span>
    ) : (
      <span className="text-[#b91c1c]">No pudimos generar el enlace: actualizá la pantalla</span>
    )
  ) : d.noAplica ? (
    <span className="text-sutil">No aplica: todavía estudia</span>
  ) : d.opcional ? (
    <span className="text-sutil">Sin cargar · optativo</span>
  ) : (
    <span className="font-semibold text-[#7A5900]">Falta cargar</span>
  );

  return (
    <li className="flex items-center gap-3 rounded-caja border border-borde bg-white p-2.5">
      {d.url && d.esImagen ? (
        <a href={d.url} target="_blank" rel="noopener noreferrer" aria-label={abrir} className="flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen privada con URL firmada que vence: no pasa por el optimizador */}
          <img src={d.url} alt="" loading="lazy" className="h-12 w-[68px] rounded-md border border-borde object-cover" />
        </a>
      ) : (
        <span
          aria-hidden
          className={cn(
            "inline-flex h-12 w-[68px] flex-none items-center justify-center rounded-md border",
            d.subido ? "border-borde bg-[#F0EFEA] text-apagado" : "border-dashed border-[#CFCCC5] text-sutil",
          )}
        >
          {d.subido ? (
            <Icono nombre="archivo" tamano={20} trazo={1.6} />
          ) : (
            "—"
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug font-semibold text-tinta">{d.etiqueta}</div>
        <div className="mt-0.5 text-xs leading-snug">{estado}</div>
      </div>
      {d.url && (
        <a
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={abrir}
          className="flex-none text-[13px] leading-none font-medium text-navy-700 hover:underline"
        >
          Abrir ↗
        </a>
      )}
    </li>
  );
}
