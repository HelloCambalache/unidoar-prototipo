import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Baby,
  Bell,
  BriefcaseBusiness,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  Clock,
  Contact,
  Cpu,
  CreditCard,
  Dumbbell,
  Ellipsis,
  ExternalLink,
  FileCheck,
  FileText,
  FileUser,
  GraduationCap,
  Handshake,
  IdCard,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  List,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageCircle,
  Palette,
  Plus,
  Presentation,
  School,
  Search,
  ShieldCheck,
  SquareKanban,
  Star,
  Store,
  Table,
  Tag,
  Timer,
  TrendingUp,
  Upload,
  User,
  UserCog,
  Users,
  WavesLadder,
  Whistle,
  X,
  Zap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { CategoriaDocente } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Los íconos de la app (Lucide, línea de trazo redondeado). Se usan por clave: menús, botones, tarjetas y avisos piden
 * `<Icono nombre="…" />` y no importan la librería, así que cambiar un dibujo es cambiar una línea acá. Un ícono nuevo
 * se suma a este mapa (y a la importación) con un nombre en español que diga qué es, no cómo se ve.
 * Quedan fuera, a propósito, los dibujos de marca (logo de Google, nodos de UNIDOAR, el corazón de la firma, la insignia de
 * "Verificado" y el pin de los mapas): no son íconos de interfaz.
 */
const ICONOS = {
  // Menús y áreas
  dashboard: LayoutDashboard,
  buscar: Search,
  instituciones: School,
  cursos: GraduationCap,
  postulaciones: FileUser,
  perfil: User,
  publicaciones: BriefcaseBusiness,
  profesionales: Contact,
  vitrina: Store,
  equipo: Users,
  plan: CreditCard,
  cuenta: UserCog,
  grafico: TrendingUp,
  etiqueta: Tag,
  escudo: ShieldCheck,
  mensaje: Mail,
  apreton: Handshake,
  // Acciones y navegación
  salir: LogOut,
  campana: Bell,
  menu: Menu,
  cerrar: X,
  mas: Plus,
  chevron: ChevronDown,
  chevronIzq: ChevronLeft,
  flecha: ArrowRight,
  volver: ArrowLeft,
  flechaDiagonal: ArrowUpRight,
  externo: ExternalLink,
  puntos: Ellipsis,
  subir: Upload,
  // Estados
  tilde: Check,
  circuloCheck: CircleCheck,
  // Datos
  ubicacion: MapPin,
  reloj: Clock,
  cronometro: Timer,
  calendario: Calendar,
  estrella: Star,
  rayo: Zap,
  chispas: Sparkles,
  whatsapp: MessageCircle,
  // Documentos y personas
  archivo: FileText,
  archivoCheck: FileCheck,
  dni: IdCard,
  imagen: ImageIcon,
  birrete: GraduationCap,
  medalla: Award,
  // Vistas
  lista: List,
  mapa: MapIcon,
  kanban: SquareKanban,
  tabla: Table,
  // Categorías de profesionales
  docente: Presentation,
  entrenador: Whistle,
  guardavidas: LifeBuoy,
  // Tipos de institución
  gimnasio: Dumbbell,
  jardin: Baby,
  arte: Palette,
  natacion: WavesLadder,
  tecnologia: Cpu,
  idiomas: Languages,
} as const satisfies Record<string, LucideIcon>;

export type IconoClave = keyof typeof ICONOS;

/** El ícono de cada categoría: pizarra para quien enseña, silbato para quien entrena y salvavidas para quien cuida la pileta. */
export const ICONO_DE_CATEGORIA: Record<CategoriaDocente, IconoClave> = {
  educador: "docente",
  entrenador: "entrenador",
  guardavidas: "guardavidas",
};

export function Icono({
  nombre,
  tamano = 16,
  trazo = 1.6,
  relleno = false,
  className,
}: {
  nombre: IconoClave;
  tamano?: number;
  trazo?: number;
  /** Rellena el dibujo con el color del texto (estrellitas de "Buscá con IA", por ejemplo). */
  relleno?: boolean;
  className?: string;
}) {
  const Dibujo = ICONOS[nombre];
  return (
    <Dibujo
      aria-hidden
      size={tamano}
      strokeWidth={trazo}
      fill={relleno ? "currentColor" : "none"}
      className={cn("flex-none", className)}
    />
  );
}
