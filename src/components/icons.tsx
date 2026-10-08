import { cn } from "@/lib/utils";

/** Íconos de línea del prototipo (viewBox 24, trazo 1.6). Se usan por clave desde los menús. */
const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  instituciones: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  cursos: (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </>
  ),
  postulaciones: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  publicaciones: <path d="M4 5h16M4 12h16M4 19h10" />,
  profesionales: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <circle cx="9" cy="10.5" r="2.3" />
      <path d="M5.4 16.2c.5-1.7 1.9-2.6 3.6-2.6s3.1.9 3.6 2.6" />
      <path d="M15.5 9.5H19" />
      <path d="M15.5 13H19" />
    </>
  ),
  vitrina: (
    <>
      <path d="M3.2 4.5h17.6l1.2 4.2a3.2 3.2 0 0 1-6.2 1.1 3.2 3.2 0 0 1-6.2 0 3.2 3.2 0 0 1-6.2-1.1z" />
      <path d="M4.6 10.6V20h14.8v-9.4" />
      <path d="M9.6 20v-5.2h4.8V20" />
    </>
  ),
  equipo: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2 20c0-3.4 3.1-5.4 7-5.4s7 2 7 5.4" />
      <circle cx="18" cy="9" r="2.4" />
      <path d="M15.5 20c0-2.4 1.2-3.6 2.5-3.6s2.5 1.2 2.5 3.6" />
    </>
  ),
  plan: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  cuenta: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6" />
    </>
  ),
  salir: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  campana: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  ubicacion: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  estrella: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  tilde: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  mas: <path d="M12 5v14M5 12h14" />,
  rayo: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  grafico: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6z" />
      <path d="M8.5 12l2.5 2.5L15.5 10" />
    </>
  ),
} as const;

export type IconoClave = keyof typeof PATHS;

export function Icono({
  nombre,
  tamano = 16,
  trazo = 1.6,
  className,
}: {
  nombre: IconoClave;
  tamano?: number;
  trazo?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("flex-none", className)}
    >
      {PATHS[nombre]}
    </svg>
  );
}
