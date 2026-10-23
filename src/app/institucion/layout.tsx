import { AppShell, type NavItem } from "@/components/app/app-shell";
import { requerirInstitucion } from "@/lib/auth";
import { notificacionesDe } from "@/lib/queries/notificaciones";
import { planes } from "@/lib/queries/planes";
import { iniciales } from "@/lib/utils";

const NAV: NavItem[] = [
  { href: "/institucion/dashboard", label: "Dashboard", icono: "dashboard" },
  { href: "/institucion/busquedas", label: "Publicaciones", icono: "publicaciones", tambien: ["/institucion/publicar", "/institucion/postulantes", "/institucion/contratar"] },
  { href: "/institucion/buscar-docentes", label: "Buscar profesionales", icono: "buscar", tambien: ["/institucion/busquedas-rapidas", "/institucion/docente"] },
  { href: "/institucion/base-de-docentes", label: "Profesionales", icono: "profesionales" },
  { href: "/institucion/vitrina", label: "Mi perfil", icono: "vitrina" },
  { href: "/institucion/sedes", label: "Sedes", icono: "ubicacion" },
  { href: "/institucion/cursos", label: "Mis cursos", icono: "cursos" },
  { href: "/institucion/equipo", label: "Equipo", icono: "equipo" },
  { href: "/institucion/plan", label: "Plan", icono: "plan" },
  { href: "/institucion/referidos", label: "Referidos", icono: "apreton" },
];

const NAV_PIE: NavItem[] = [{ href: "/institucion/cuenta", label: "Mi cuenta", icono: "cuenta" }];

export default async function InstitucionLayout({ children }: { children: React.ReactNode }) {
  const { usuario, institucion } = await requerirInstitucion();
  const [notificaciones, P] = await Promise.all([notificacionesDe(usuario.id), planes()]);
  const plan = P.planDe(institucion.plan);
  // Una búsqueda puntual puede no incluir el buscador de profesionales ni la difusión de cursos (lo decide el equipo en Planes): no se ofrecen en el menú.
  const sinBuscador = !P.incluye(institucion.plan, "buscador");
  const sinCursos = !P.incluye(institucion.plan, "cursos");
  const nav = NAV.filter(
    (item) =>
      !(sinBuscador && (item.href === "/institucion/buscar-docentes" || item.href === "/institucion/base-de-docentes")) &&
      !(sinCursos && item.href === "/institucion/cursos"),
  );

  return (
    <AppShell
      tema="institucion"
      nombre={institucion.nombre}
      iniciales={iniciales(institucion.contactoNombre ?? institucion.nombre)}
      insignia={{ texto: plan.label, href: "/institucion/plan", titulo: "Ver plan y facturación" }}
      nav={nav}
      navPie={NAV_PIE}
      tarjetaPie={
        <div className="rounded-caja border border-borde bg-superficie px-3 py-3.5">
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
