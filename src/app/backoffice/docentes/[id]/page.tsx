import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocAccionesCuenta } from "@/components/backoffice/doc-acciones-cuenta";
import { DocProcesarBaja } from "@/components/backoffice/doc-procesar-baja";
import { DocReabrirRevision } from "@/components/backoffice/doc-reabrir-revision";
import {
  DocCabecera,
  DocContacto,
  DocCuenta,
  DocDocumentacion,
  DocMetricas,
  DocPostulaciones,
  DocScoring,
} from "@/components/backoffice/doc-ficha";
import { BotonVolver } from "@/components/institucion/boton-volver";
import { botonClases } from "@/components/ui/button";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { enlaceWhatsApp, puedeReabrirRevision } from "@/lib/backoffice-docentes";
import { esUuid } from "@/lib/busquedas";
import { resumenParaBaja } from "@/lib/queries/baja-docente";
import { fichaDocenteBo } from "@/lib/queries/backoffice-docentes";
import { Icono } from "@/components/icons";

export const metadata: Metadata = { title: "Ficha del profesional" };
// DNI, CUIL y enlaces firmados a documentos: nada de esta pantalla se cachea.
export const dynamic = "force-dynamic";

export default async function FichaDocentePage({ params }: { params: Promise<{ id: string }> }) {
  // El layout ya exige rol admin, pero Next puede renderizar una página sin volver a renderizar su layout (navegación parcial): se repite acá.
  await requerirUsuario("admin");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const ficha = await fichaDocenteBo(id);
  if (!ficha) notFound();

  const d = ficha.docente;
  // Solo una cuenta real (con acceso y que no es de ejemplo) puede darse de baja.
  const resumenDeBaja = d.usuarioId && ficha.emailCuenta && !d.esDemo ? await resumenParaBaja(d.id) : null;
  const nombre = `${d.nombre} ${d.apellido}`.trim();
  const whatsapp = enlaceWhatsApp(d.telefono);

  return (
    <>
      <nav aria-label="Ruta" className="mb-[18px] flex items-center gap-2">
        <BotonVolver fallback="/backoffice/docentes" />
        <span className="min-w-0 truncate text-[13px] leading-none text-apagado">
          <Link href="/backoffice/docentes" className="text-apagado hover:text-tinta">
            Profesionales
          </Link>
          <span className="px-[7px] text-borde-fuerte">/</span>
          <span className="font-medium text-tinta">{nombre}</span>
        </span>
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[320px] flex-1 flex-col gap-4 max-[860px]:min-w-0 max-[860px]:basis-full">
          <DocCabecera ficha={ficha} />
          <DocMetricas ficha={ficha} />
          <DocPostulaciones ficha={ficha} />
          <DocDocumentacion ficha={ficha} />
          <DocScoring ficha={ficha} />
        </div>

        <aside className="flex w-[300px] max-w-full flex-none flex-col gap-4 max-[860px]:w-full">
          <DocContacto ficha={ficha} />
          <DocCuenta ficha={ficha} />
          <Tarjeta como="section" className="flex flex-col gap-2.5 p-[22px]">
            <EtiquetaSeccion className="mb-0.5">Acciones</EtiquetaSeccion>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={botonClases({ variante: "secundario", bloque: true })}
              >
                <Icono nombre="whatsapp" tamano={16} trazo={1.8} />
                Contactar por WhatsApp
              </a>
            ) : (
              <p className="m-0 rounded-caja bg-[#F0EFEA] px-3.5 py-2.5 text-[13px] leading-normal text-apagado">
                {d.telefono ? "El teléfono cargado no alcanza para armar el enlace de WhatsApp." : "No cargó un teléfono: no hay a dónde escribirle."}
              </p>
            )}
            {puedeReabrirRevision(d.verificacion) && d.usuarioId && <DocReabrirRevision docenteId={d.id} nombre={nombre} />}
            <DocAccionesCuenta docenteId={d.id} nombre={nombre} suspendido={d.suspendido} tieneCuenta={!!d.usuarioId} />
            {resumenDeBaja && ficha.emailCuenta && (
              <DocProcesarBaja
                docenteId={d.id}
                nombre={nombre}
                email={ficha.emailCuenta}
                resumen={resumenDeBaja}
                pidioLaBaja={!!ficha.bajaSolicitadaEn}
              />
            )}
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}
