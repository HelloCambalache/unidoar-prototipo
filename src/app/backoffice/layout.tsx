import { AppShell, type NavItem } from "@/components/app/app-shell";
import { requerirUsuario } from "@/lib/auth";
import { modoDeMercadoPago } from "@/lib/queries/mercadopago-modo";

/** Área del equipo de UNIDOAR: solo cuentas con rol `admin` (ver `pnpm db:admin`). */
const NAV: NavItem[] = [
  { href: "/backoffice/operacion", label: "Operación", icono: "grafico", grupo: "Panel" },
  { href: "/backoffice/verificacion", label: "Verificación", icono: "escudo", grupo: "Personas" },
  { href: "/backoffice/docentes", label: "Profesionales", icono: "perfil", grupo: "Personas" },
  { href: "/backoffice/instituciones", label: "Instituciones", icono: "instituciones", grupo: "Personas" },
  { href: "/backoffice/altas-sin-terminar", label: "Altas sin terminar", icono: "equipo", grupo: "Personas" },
  { href: "/backoffice/cobros", label: "Cobros", icono: "plan", grupo: "Negocio" },
  { href: "/backoffice/planes", label: "Planes", icono: "estrella", grupo: "Negocio" },
  { href: "/backoffice/referidos", label: "Referidos", icono: "apreton", grupo: "Negocio" },
  { href: "/backoffice/categorias", label: "Categorías", icono: "etiqueta", grupo: "Contenido" },
  { href: "/backoffice/mensajes", label: "Mensajes", icono: "mensaje", grupo: "Contenido" },
];

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  // Cualquier otro rol vuelve a su propio inicio; sin sesión, al ingreso.
  const usuario = await requerirUsuario("admin");
  const iniciales = usuario.email.slice(0, 2).toUpperCase();
  // Con un token de prueba cargado los cobros no son reales: se avisa a todo el equipo en cada pantalla hasta que se cambie por el de producción.
  const modoDeCobro = await modoDeMercadoPago();

  return (
    <AppShell
      tema="backoffice"
      nombre="Equipo UNIDOAR · Backoffice"
      iniciales={iniciales}
      insignia={{ texto: "Backoffice", href: "/backoffice/operacion", titulo: "Equipo UNIDOAR" }}
      nav={NAV}
    >
      {modoDeCobro === "prueba" && (
        <div role="alert" className="mb-4 rounded-caja border border-[#EBCFC5] bg-[#F6E6E0] px-4 py-3 text-[13.5px] leading-normal text-[#8F3D28]">
          <b className="font-semibold">Mercado Pago está en modo PRUEBA.</b> Los cobros no son reales y solo las instituciones de ejemplo pueden activar el débito
          automático. Antes de abrir a instituciones reales, cargá el Access Token de producción (<code>APP_USR-…</code>) en Vercel y volvé a desplegar: con
          un token de prueba, un cobro no entra a ningún lado y no da ninguna señal.
        </div>
      )}
      {children}
    </AppShell>
  );
}
