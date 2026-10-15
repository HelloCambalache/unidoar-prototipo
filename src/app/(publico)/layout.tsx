import { CabeceraPublica } from "@/components/publico/cabecera";
import { PiePublico } from "@/components/publico/pie";
import "./publico.css";

/** Marco del sitio público: cabecera y pie compartidos. La sesión solo cambia el botón de acceso. */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-lienzo">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-navy-700 focus:shadow-dropdown"
      >
        Saltar al contenido
      </a>
      <CabeceraPublica />
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <PiePublico />
    </div>
  );
}
