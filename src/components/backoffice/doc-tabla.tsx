import Link from "next/link";
import { DocInsigniaSuspendida, DocInsigniaVerificacion } from "@/components/backoffice/doc-insignias";
import { FilaClicable } from "@/components/docente/fila-clicable";
import { Avatar } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import type { FilaDocenteBo } from "@/lib/queries/backoffice-docentes";
import { iniciales } from "@/lib/utils";

/**
 * Tabla de docentes del backoffice (listado y "Docentes por calidad de perfil" de Operación):
 * Docente · Disciplina · Zona · Verificación · Postulaciones · Contrataciones · Scoring.
 * La fila entera abre la ficha; el nombre es el link real para teclado y lectores de pantalla.
 */
export function DocTabla({ filas }: { filas: FilaDocenteBo[] }) {
  return (
    <Tabla className="min-w-[820px]">
      <thead>
        <tr>
          <th>Profesional</th>
          <th>Disciplina</th>
          <th>Zona</th>
          <th>Verificación</th>
          <th className="text-right">Postulaciones</th>
          <th className="text-right">Contrataciones</th>
          <th className="text-right">Scoring</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const info = CATEGORIA_INFO[f.categoria];
          const ficha = `/backoffice/docentes/${f.id}`;
          return (
            <FilaClicable key={f.id} href={ficha}>
              <td>
                <div className="flex items-center gap-[11px]">
                  <Avatar iniciales={iniciales(f.nombre)} fotoUrl={f.fotoUrl} tamano={34} fondo={info.tint} texto={info.ink} />
                  <div className="min-w-0">
                    <Link href={ficha} className="font-semibold text-tinta hover:text-navy-700 hover:underline">
                      {f.nombre}
                    </Link>
                    <div className="text-xs leading-snug text-sutil">{info.label}</div>
                  </div>
                </div>
              </td>
              <td>{f.disciplina}</td>
              <td>{f.zona}</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <DocInsigniaVerificacion estado={f.verificacion} />
                  {f.suspendido && <DocInsigniaSuspendida />}
                </div>
              </td>
              <td className="text-right tabular-nums">{f.postulaciones}</td>
              <td className="text-right tabular-nums">{f.contrataciones}</td>
              <td className="text-right font-bold tabular-nums">{f.scoring}</td>
            </FilaClicable>
          );
        })}
      </tbody>
    </Tabla>
  );
}
