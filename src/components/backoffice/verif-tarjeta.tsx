import Link from "next/link";
import { DocInsigniaSuspendida, DocInsigniaVerificacion } from "@/components/backoffice/doc-insignias";
import { VerifAcciones } from "@/components/backoffice/verif-acciones";
import { VerifDocumento } from "@/components/backoffice/verif-documento";
import { Avatar } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { cuilLegible, dniLegible } from "@/lib/backoffice-docentes";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { etiquetaDeEstudiante } from "@/lib/estudiantes";
import { fechaCorta, fechaDeInput, haceTiempo } from "@/lib/fechas";
import type { ItemCola } from "@/lib/queries/backoffice-docentes";
import { cn, iniciales } from "@/lib/utils";

function Dato({ etiqueta, children, alerta }: { etiqueta: string; children: React.ReactNode; alerta?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[13px] leading-snug">
      <dt className="text-apagado">{etiqueta}</dt>
      <dd className={cn("m-0 text-right font-medium", alerta ? "text-[#7A5900]" : "text-tinta")}>{children}</dd>
    </div>
  );
}

/**
 * Un docente de la cola de verificación: quién es, sus datos de identidad (DNI y CUIL), qué falta, los documentos
 * para revisar y las acciones. Sensible: solo se renderiza bajo /backoffice.
 */
export function VerifTarjeta({ item }: { item: ItemCola }) {
  const info = CATEGORIA_INFO[item.categoria];
  const doc = (clave: string) => item.documentos.find((d) => d.clave === clave)!;
  const credencial = doc("credencial");
  const contacto = [item.email, item.telefono].filter(Boolean).join(" · ");

  return (
    <Tarjeta como="article" id={`d-${item.id}`} className="scroll-mt-4 overflow-hidden p-0">
      <div className="flex flex-wrap items-start gap-4 px-[22px] pt-[22px] pb-4">
        <Avatar iniciales={iniciales(item.nombre)} fotoUrl={item.fotoUrl} tamano={56} fondo={info.tint} texto={info.ink} />
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-[17px] leading-[1.25] font-semibold tracking-[-0.01em]">{item.nombre}</h2>
            <DocInsigniaVerificacion estado={item.verificacion} />
            {item.suspendido && <DocInsigniaSuspendida />}
          </div>
          <div className="text-[13px] leading-snug text-apagado">
            {item.subtitulo ?? [info.label, ...item.zonas.slice(0, 2)].join(" · ")}
          </div>
          <div className="mt-1 text-xs leading-snug text-sutil">
            {item.verificacion === "correccion" && item.revisadaEn
              ? `Corrección pedida ${haceTiempo(item.revisadaEn)}`
              : `Se registró ${haceTiempo(item.creadoEn)} (${fechaCorta(item.creadoEn)})`}
            {contacto && ` · ${contacto}`}
          </div>
        </div>
        <Link href={`/backoffice/docentes/${item.id}`} className="flex-none text-[13px] leading-none font-medium text-navy-700 hover:underline">
          Ver ficha completa →
        </Link>
      </div>

      <div
        className={cn(
          "mx-[22px] mb-4 rounded-lg px-3.5 py-2.5 text-[13px] leading-normal",
          item.faltantes.length > 0 ? "bg-[#FEF1DF] text-[#8A4B07]" : "bg-verde-tint text-verde",
        )}
      >
        {item.faltantes.length > 0 ? (
          <>
            <b className="font-semibold">Falta:</b> {item.faltantes.join(" · ")}
          </>
        ) : (
          "Tiene toda la documentación obligatoria cargada."
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6 px-[22px] pb-5 max-[860px]:grid-cols-1">
        <div>
          <EtiquetaSeccion>Datos de identidad</EtiquetaSeccion>
          <dl className="m-0 flex flex-col gap-2">
            <Dato etiqueta="DNI" alerta={!item.identidad.dni}>
              {item.identidad.dni ? dniLegible(item.identidad.dni) : "Sin cargar"}
            </Dato>
            <Dato etiqueta="CUIL">{item.identidad.cuil ? cuilLegible(item.identidad.cuil) : "—"}</Dato>
            <Dato etiqueta="Nacimiento">
              {item.identidad.fechaNacimiento ? fechaDeInput(item.identidad.fechaNacimiento) : "—"}
            </Dato>
            <Dato etiqueta="Situación">
              {item.identidad.estudia ? etiquetaDeEstudiante(item.identidad.porcentajeMaterias) : "Ya se recibió"}
            </Dato>
          </dl>
          {item.verificacion === "correccion" && item.nota && (
            <div className="mt-4 rounded-lg bg-[#FEF1DF] px-3.5 py-2.5 text-[13px] leading-normal text-[#8A4B07]">
              <b className="font-semibold">Corrección que se pidió:</b> {item.nota}
            </div>
          )}
        </div>
        <div>
          <EtiquetaSeccion>Documentos</EtiquetaSeccion>
          <ul className="m-0 grid list-none gap-2.5 p-0 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
            {item.documentos.map((d) => (
              <VerifDocumento key={d.clave} d={d} />
            ))}
          </ul>
        </div>
      </div>

      <VerifAcciones
        docenteId={item.id}
        nombre={item.nombre}
        credencial={credencial.etiqueta}
        tiene={{
          dni: doc("dniFrente").subido && doc("dniDorso").subido,
          credencial: credencial.subido,
          constancia: item.documentos.some((d) => d.clave === "constancia" && d.subido),
          conducta: doc("conducta").subido,
        }}
        credencialNoAplica={credencial.noAplica}
        estudiante={item.identidad.estudia}
      />
    </Tarjeta>
  );
}
