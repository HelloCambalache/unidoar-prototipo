"use client";

import { Boton } from "@/components/ui/button";
import { slugify } from "@/lib/utils";

export type FilaInscripto = {
  nombre: string;
  categoria: string;
  inscriptoEl: string;
  /** "Cursando" o "Terminó el 12/10/2026". */
  estado: string;
  /** "Enviado", "Sin enviar", "Sin certificado". */
  certificado: string;
};

const COLUMNAS = ["Nombre", "Categoría", "Se inscribió el", "Estado", "Certificado"];

/** Una celda del CSV: comillas escapadas y, si empieza como una fórmula (=, +, -, @), con un apóstrofo delante para que Excel no la ejecute. */
function celda(valor: string) {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replaceAll('"', '""')}"`;
}

/**
 * Baja la lista de inscriptos como CSV (separado por punto y coma, con BOM, para que Excel en español la
 * abra bien). Se arma en el navegador con lo que la pantalla ya muestra. No incluye teléfono ni email:
 * inscribirse a un curso no los comparte con la institución.
 */
export function CursoDescargarLista({ titulo, filas }: { titulo: string; filas: FilaInscripto[] }) {
  const descargar = () => {
    const lineas = [
      COLUMNAS.map(celda).join(";"),
      ...filas.map((f) => [f.nombre, f.categoria, f.inscriptoEl, f.estado, f.certificado].map(celda).join(";")),
    ];
    const blob = new Blob([`﻿${lineas.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `inscriptos-${slugify(titulo) || "curso"}.csv`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Boton variante="secundario" onClick={descargar} disabled={filas.length === 0}>
      Descargar lista
    </Boton>
  );
}
