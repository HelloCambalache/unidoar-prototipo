import { AppShell, type NavItem } from "@/components/app/app-shell";
import { requerirUsuario } from "@/lib/auth";

/** Área del equipo de UNIDOAR: solo cuentas con rol `admin` (ver `pnpm db:admin`). */
const NAV: NavItem[] = [
  { href: "/backoffice/operacion", label: "Operación", icono: "grafico", grupo: "Panel" },
  { href: "/backoffice/verificacion", label: "Verificación", icono: "escudo", grupo: "Personas" },
  { href: "/backoffice/docentes", label: "Profesionales", icono: "perfil", grupo: "Personas" },
  { href: "/backoffice/instituciones", label: "Instituciones", icono: "instituciones", grupo: "Personas" },
  { href: "/backoffice/altas-sin-terminar", label: "Altas sin terminar", icono: "equipo", grupo: "Personas" },
  { href: "/backoffice/cobros", label: "Cobros", icono: "plan", grupo: "Negocio" },
  { href: "/backoffice/planes", label: "Planes", icono: "estrella", grupo: "Negocio" },
  { href: "/backoffice/categorias", label: "Categorías", icono: "etiqueta", grupo: "Contenido" },
  { href: "/backoffice/mensajes", label: "Mensajes", icono: "publicaciones", grupo: "Contenido" },
];

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  // Cualquier otro rol vuelve a su propio inicio; sin sesión, al ingreso.
  const usuario = await requerirUsuario("admin");
  const iniciales = usuario.email.slice(0, 2).toUpperCase();

  return (
    <AppShell
      tema="backoffice"
      nombre="Equipo UNIDOAR · Backoffice"
      iniciales={iniciales}
      insignia={{ texto: "Backoffice", href: "/backoffice/operacion", titulo: "Equipo UNIDOAR" }}
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}
