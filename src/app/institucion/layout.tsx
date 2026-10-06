import { AppShell, type NavItem } from "@/components/app/app-shell";
import { requerirInstitucion } from "@/lib/auth";
import { notificacionesDe } from "@/lib/queries/notificaciones";
import { planDe } from "@/lib/planes";
import { iniciales } from "@/lib/utils";

const NAV: NavItem[] = [
  { href: "/institucion/dashboard", label: "Dashboard", icono: "dashboard" },
  { href: "/institucion/busquedas", label: "Publicaciones", icono: "publicaciones", tambien: ["/institucion/publicar", "/institucion/postulantes", "/institucion/contratar"] },
  { href: "/institucion/buscar-docentes", label: "Buscar profesionales", icono: "buscar", tambien: ["/institucion/busquedas-rapidas", "/institucion/docente"] },
  { href: "/institucion/base-de-docentes", label: "Profesionales", icono: "profesionales" },
  { href: "/institucion/vitrina", label: "Mi perfil", icono: "vitrina" },
  { href: "/institucion/cursos", label: "Mis cursos", icono: "cursos" },
  { href: "/institucion/equipo", label: "Equipo", icono: "equipo" },
  { href: "/institucion/plan", label: "Plan", icono: "plan" },
];

const NAV_PIE: NavItem[] = [{ href: "/institucion/cuenta", label: "Mi cuenta", icono: "cuenta" }];

export default async function InstitucionLayout({ children }: { children: React.ReactNode }) {
  const { usuario, institucion } = await requerirInstitucion();
  const notificaciones = await notificacionesDe(usuario.id);
  const plan = planDe(institucion.plan);

  return (
    <AppShell
      tema="institucion"
      nombre={institucion.nombre}
      iniciales={iniciales(institucion.contactoNombre ?? institucion.nombre)}
      insignia={{ texto: plan.label, href: "/institucion/plan", titulo: "Ver plan y facturación" }}
      nav={NAV}
      navPie={NAV_PIE}
      tarjetaPie={
        <div className="rounded-lg border border-borde bg-superficie px-3 py-3.5">
          <div className="mb-[5px] text-[13px] leading-tight font-semibold">{plan.label}</div>
          <div className="text-xs leading-normal text-apagado">{plan.resumen}</div>
        </div>
      }
      notificaciones={notificaciones}
    >
      {children}
    </AppShell>
  );
}
