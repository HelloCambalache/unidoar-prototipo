import type { Metadata } from "next";
import { headers } from "next/headers";
import { EquipoPanel } from "@/components/institucion/equipo-panel";
import { requerirInstitucion } from "@/lib/auth";
import { modoCorreo } from "@/lib/correo/config";
import { esRolGestor } from "@/lib/equipo";
import { miembrosDeInstitucion, rolEnInstitucion } from "@/lib/queries/equipo";

export const metadata: Metadata = { title: "Equipo" };

/** Origen del sitio para armar el enlace de registro que se le pasa a quien se invita. */
async function origenSitio() {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurada) return configurada.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

export default async function Equipo() {
  const { usuario, institucion } = await requerirInstitucion();
  const [miembros, rol, origen] = await Promise.all([
    miembrosDeInstitucion(institucion, usuario.id),
    rolEnInstitucion(institucion, usuario.id),
    origenSitio(),
  ]);

  return (
    <EquipoPanel
      miembros={miembros}
      puedeGestionar={esRolGestor(rol)}
      urlRegistro={`${origen}/registro`}
      correoActivo={modoCorreo() !== "apagado"}
    />
  );
}
