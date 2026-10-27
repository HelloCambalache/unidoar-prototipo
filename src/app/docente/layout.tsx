import { AppShell, type NavItem } from "@/components/app/app-shell";
import { requerirDocente } from "@/lib/auth";
import { notificacionesDe } from "@/lib/queries/notificaciones";
import { pendientesDePerfil } from "@/lib/perfil";
import { iniciales } from "@/lib/utils";

const NAV: NavItem[] = [
  { href: "/docente/dashboard", label: "Dashboard", icono: "dashboard" },
  { href: "/docente/oportunidades", label: "Buscar trabajo", icono: "buscar", tambien: ["/docente/busquedas-rapidas", "/docente/oferta"] },
  { href: "/docente/instituciones", label: "Instituciones", icono: "instituciones" },
  { href: "/docente/cursos", label: "Cursos", icono: "cursos" },
  { href: "/docente/postulaciones", label: "Postulaciones", icono: "postulaciones" },
  { href: "/docente/perfil", label: "Mi perfil", icono: "perfil" },
];

const NAV_PIE: NavItem[] = [
  { href: "/ayuda/profesionales", label: "Ayuda", icono: "ayuda" },
  { href: "/docente/cuenta", label: "Mi cuenta", icono: "cuenta" },
];

export default async function DocenteLayout({ children }: { children: React.ReactNode }) {
  const { usuario, docente } = await requerirDocente();
  const notificaciones = await notificacionesDe(usuario.id);
  const { porcentaje } = pendientesDePerfil(docente);
  const nombre = `${docente.nombre} ${docente.apellido}`.trim();

  return (
    <AppShell
      tema="docente"
      nombre={nombre}
      iniciales={iniciales(nombre)}
      insignia={{ texto: `Perfil ${porcentaje}%`, href: "/docente/perfil", titulo: "Ir a mi perfil" }}
      nav={NAV}
      navPie={NAV_PIE}
      notificaciones={notificaciones}
      verTodasHref="/docente/notificaciones"
    >
      {children}
    </AppShell>
  );
}
