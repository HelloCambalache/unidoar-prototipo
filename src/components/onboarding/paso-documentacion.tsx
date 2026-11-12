"use client";

import { useActionState, useState } from "react";
import { guardarDocumentacionDocente } from "@/app/actions/onboarding";
import type { CategoriaDocente, DocumentosDocente } from "@/db/schema";
import { Boton } from "@/components/ui/button";
import { AvisoSinAlmacenamiento, SubirArchivo } from "@/components/ui/subir-archivo";
import { BotonEnvio } from "@/components/onboarding/boton-envio";
import { AlertaError, EnlaceVolver, TituloPaso } from "@/components/onboarding/elementos";
import { credencialesQueSePiden } from "@/lib/categorias-docente";
import { FOTOS_DNI_SE_ELIMINAN } from "@/lib/documentos";
import { CONSTANCIA } from "@/lib/estudiantes";
import { ID_FORMULARIO_ONBOARDING, type SituacionEstudio } from "@/lib/onboarding";
import { CLAVES_DE_TITULO, casillasAbiertas, etiquetaDeCasilla, MAX_TITULOS, type ClaveDeTitulo } from "@/lib/titulos";
import { cn } from "@/lib/utils";
import { Icono } from "@/components/icons";

function Fila({
  icono,
  cargado,
  nombre,
  detalle,
  children,
}: {
  icono: "dni" | "credencial";
  cargado: boolean;
  nombre: string;
  detalle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-caja border border-borde px-4 py-3.5 max-[640px]:flex-wrap">
      <span
        className={cn(
          "inline-flex size-[30px] flex-none items-center justify-center rounded-[7px]",
          cargado ? "bg-verde-tint text-verde" : "bg-[#F3F2EE] text-sutil",
        )}
      >
        <Icono nombre={icono === "dni" ? "dni" : "birrete"} tamano={15} trazo={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug font-medium">{nombre}</div>
        <div className="text-xs leading-snug text-apagado">{detalle}</div>
      </div>
      {cargado && (
        <span className="flex-none rounded-full bg-verde-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-verde">Cargado</span>
      )}
      <div className="flex flex-none gap-2 max-[640px]:mt-1.5 max-[640px]:flex-[1_1_100%] max-[640px]:[&>span]:flex-1 max-[640px]:[&_button]:w-full">
        {children}
      </div>
    </div>
  );
}

/**
 * "Subí tu documentación": DNI (frente y dorso) y, si ya se recibió, el título o certificación (si todavía estudia, la
 * constancia de alumno regular en su lugar). Los archivos van
 * al bucket privado; acá solo se guardan sus paths. Subir es opcional: el perfil queda "sin verificar" (pendiente)
 * hasta que el equipo revise lo que haya. Acá se cierra el alta.
 */
export function PasoDocumentacion({
  categorias,
  estudio,
  documentos,
  almacenamientoDisponible,
}: {
  /** Las categorías del perfil (la principal primero): con varias se pide un título por cada una. */
  categorias: CategoriaDocente[];
  estudio: SituacionEstudio;
  documentos: DocumentosDocente;
  almacenamientoDisponible: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(guardarDocumentacionDocente, null);
  const [cargados, setCargados] = useState({
    dniFrente: Boolean(documentos.dniFrente),
    dniDorso: Boolean(documentos.dniDorso),
    constancia: Boolean(documentos.constancia),
  });
  // Varios títulos, cada uno en su casilla: se muestran los cargados y se abre otra con «Agregar otro título».
  const [titulos, setTitulos] = useState<Record<ClaveDeTitulo, boolean>>(
    () => Object.fromEntries(CLAVES_DE_TITULO.map((k) => [k, Boolean(documentos[k])])) as Record<ClaveDeTitulo, boolean>,
  );
  const [casillas, setCasillas] = useState(() => casillasAbiertas(documentos));
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const marcar = (clave: keyof typeof cargados) => (valor: string) => setCargados((c) => ({ ...c, [clave]: valor !== "" }));

  const credencial = credencialesQueSePiden({ categoria: categorias[0]!, categoriasExtra: categorias.slice(1) });
  const dniCompleto = cargados.dniFrente && cargados.dniDorso;
  const detalleDni = dniCompleto
    ? "Frente y dorso cargados"
    : cargados.dniFrente
      ? "Falta el dorso"
      : cargados.dniDorso
        ? "Falta el frente"
        : "Foto o PDF de cada lado";

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <TituloPaso
        grande
        titulo="Subí tu documentación"
        bajada={
          <>
            Podés empezar a postularte ahora. Tu perfil va a mostrarse como <strong className="font-semibold text-tinta">Sin verificar</strong>{" "}
            hasta que revisemos la documentación — normalmente en menos de 48 horas. Si no la tenés a mano, la podés subir después desde Mi perfil.
          </>
        }
      />

      <div className="flex flex-col gap-2.5">
        <Fila icono="dni" cargado={dniCompleto} nombre="DNI — frente y dorso" detalle={detalleDni}>
          <SubirArchivo
            bucket="privado"
            carpeta="documentos"
            nombre="dniFrente"
            etiqueta="DNI, frente"
            variante="boton"
            textoBoton="Frente"
            valorInicial={documentos.dniFrente}
            disponible={almacenamientoDisponible}
            onCambio={marcar("dniFrente")}
          />
          <SubirArchivo
            bucket="privado"
            carpeta="documentos"
            nombre="dniDorso"
            etiqueta="DNI, dorso"
            variante="boton"
            textoBoton="Dorso"
            valorInicial={documentos.dniDorso}
            disponible={almacenamientoDisponible}
            onCambio={marcar("dniDorso")}
          />
        </Fila>
        {estudio === "estudiante" ? (
          // Quien todavía estudia presenta la constancia de alumno regular en lugar del título.
          <Fila
            icono="credencial"
            cargado={cargados.constancia}
            nombre={CONSTANCIA.nombre}
            detalle={cargados.constancia ? CONSTANCIA.corto : CONSTANCIA.vacio}
          >
            <SubirArchivo
              bucket="privado"
              carpeta="documentos"
              nombre="constancia"
              etiqueta={CONSTANCIA.nombre}
              variante="boton"
              textoBoton="Subir archivo"
              valorInicial={documentos.constancia}
              disponible={almacenamientoDisponible}
              onCambio={marcar("constancia")}
            />
          </Fila>
        ) : (
          <>
            {CLAVES_DE_TITULO.slice(0, casillas).map((clave, i) => {
              const nombre = etiquetaDeCasilla(i, casillas, credencial.nombre);
              return (
                <Fila
                  key={clave}
                  icono="credencial"
                  cargado={titulos[clave]}
                  nombre={nombre}
                  detalle={titulos[clave] ? credencial.corto : i === 0 ? credencial.vacio : "Otro título o certificación (PDF o foto)"}
                >
                  <SubirArchivo
                    bucket="privado"
                    carpeta="documentos"
                    nombre={clave}
                    etiqueta={nombre}
                    variante="boton"
                    textoBoton="Subir archivo"
                    valorInicial={documentos[clave]}
                    disponible={almacenamientoDisponible}
                    onCambio={(v) => setTitulos((t) => ({ ...t, [clave]: v !== "" }))}
                  />
                </Fila>
              );
            })}
            {/* Otro título (de otra categoría, otra certificación…): cada uno va en su propio archivo. */}
            {casillas < MAX_TITULOS && titulos[CLAVES_DE_TITULO[casillas - 1]!] && (
              <Boton variante="secundario" tamano="sm" className="self-start" onClick={() => setCasillas((n) => Math.min(MAX_TITULOS, n + 1))}>
                + Agregar otro título
              </Boton>
            )}
          </>
        )}
      </div>
      <p className="m-0 mt-3 flex items-start gap-2 rounded-caja bg-[#F7F6F2] px-3.5 py-3 text-[13px] leading-[1.45] text-apagado">
        <Icono nombre="escudo" tamano={16} trazo={1.8} className="mt-px text-navy-700" />
        <span>{FOTOS_DNI_SE_ELIMINAN}</span>
      </p>
      {Object.values(campos).length > 0 && (
        <p role="alert" className="mt-2.5 text-xs text-[#b91c1c]">
          {Object.values(campos)[0]}
        </p>
      )}
      {!almacenamientoDisponible && <AvisoSinAlmacenamiento className="mt-3" />}

      <AlertaError className="mt-3.5">{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
      <div className="mt-[22px] flex flex-wrap items-center justify-between gap-3">
        <EnlaceVolver href="/onboarding/docente/asignaturas" />
        <div className="flex flex-[1_1_320px] flex-wrap justify-end gap-2.5">
          <BotonEnvio campo="destino" valor="luego" variante="secundario" disabled={pendiente} className="flex-[1_1_auto]">
            Lo subo después
          </BotonEnvio>
          <Boton type="submit" disabled={pendiente} className="flex-[1_1_auto]">
            {pendiente ? "Guardando…" : "Terminar y buscar trabajo"}
          </Boton>
        </div>
      </div>
    </form>
  );
}
