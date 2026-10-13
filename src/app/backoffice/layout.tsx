import { AppShell, type NavItem } from "@/components/app/app-shell";
import { requerirUsuario } from "@/lib/auth";

/** Área del equipo de UNIDOAR: solo cuentas con rol `admin` (ver `pnpm db:admin`). */
const NAV: NavItem[] = [
  { href: "/backoffice/operacion", label: "Operación", icono: "grafico" },
  { href: "/backoffice/verificacion", label: "Verificación", icono: "escudo" },
  { href: "/backoffice/docentes", label: "Profesionales", icono: "perfil" },
  { href: "/backoffice/instituciones", label: "Instituciones", icono: "instituciones" },
  { href: "/backoffice/categorias", label: "Categorías", icono: "etiqueta" },
  { href: "/backoffice/cobros", label: "Cobros", icono: "plan" },
  { href: "/backoffice/planes", label: "Planes", icono: "estrella" },
  { href: "/backoffice/mensajes", label: "Mensajes", icono: "publicaciones" },
];

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  // Cualquier otro rol vuelve a su propio inicio; sin sesión, al ingreso.
  const usuario = await requerirUsuario("admin");
  const iniciales = usuario.email.slice(0, 2).toUpperCase();

  return (
    <AppShell
      tema="backoffice"
      nombre="Backoffice"
      iniciales={iniciales}
      insignia={{ texto: "Backoffice", href: "/backoffice/operacion", titulo: "Equipo UNIDOAR" }}
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}
