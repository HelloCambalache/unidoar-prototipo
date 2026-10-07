"use client";

import { useEffect, useRef, useState } from "react";
import { Boton } from "@/components/ui/button";
import { Icono } from "@/components/icons";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/env";
import {
  LIMITE_CUERPO_PETICION,
  LIMITE_ORIGINAL_IMAGEN,
  LIMITE_PDF,
  MIME_IMAGEN,
  MIME_PDF,
  aceptaDeTipo,
  mb,
  nombreDePath,
  tipoDeCarpeta,
  type CarpetaDe,
  type TipoArchivo,
} from "@/lib/subidas";
import { cn } from "@/lib/utils";

const TEXTO_SIN_ALMACENAMIENTO = "La subida de archivos se habilita en cuanto se configure el almacenamiento.";

/** Aviso para páginas con varios botones de subida deshabilitados (se muestra una vez, no por botón). */
export function AvisoSinAlmacenamiento({ className }: { className?: string }) {
  return (
    <p role="status" className={cn("text-xs leading-normal text-sutil", className)}>
      {TEXTO_SIN_ALMACENAMIENTO}
    </p>
  );
}

type Destino =
  | { bucket: "publico"; carpeta: CarpetaDe<"publico"> }
  | { bucket: "privado"; carpeta: CarpetaDe<"privado"> };

type Props = Destino & {
  /** `name` del input oculto que lleva el valor al formulario: URL pública (bucket publico) o path (privado). */
  nombre: string;
  etiqueta?: string;
  /** Texto de ayuda; por defecto el formato y el peso máximo según el tipo de la carpeta. */
  ayuda?: string;
  /** Valor ya guardado (URL pública o path privado). */
  valorInicial?: string | null;
  /** URL para ver lo ya guardado: obligatoria para mostrar imágenes del bucket privado (URL firmada). */
  vistaInicial?: string | null;
  variante?: "circulo" | "banner" | "zona" | "boton";
  /** Variante `boton`: texto del botón sin archivo ("Subir archivo", "Frente"…). */
  textoBoton?: string;
  /** Variante `zona`: título de la caja de arrastre. */
  titulo?: string;
  /** Si es false se muestra deshabilitado. Por defecto: hay URL de Supabase configurada. */
  disponible?: boolean;
  onCambio?: (valor: string) => void;
  className?: string;
};

type Resultado = { ok: true; path: string; url: string | null; nombre: string; tamano: number } | { ok: false; error: string };

/** Intentos de achicado, de más a menos calidad: se corta en el primero que entra en el cuerpo de una petición. */
const INTENTOS_DE_COMPRESION = [
  { lado: 2000, calidad: 0.85 },
  { lado: 1600, calidad: 0.75 },
  { lado: 1200, calidad: 0.65 },
] as const;

async function redimensionar(archivo: File, { lado, calidad }: { lado: number; calidad: number }): Promise<File> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("sin canvas");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  // PNG → WebP conserva la transparencia de los logos y pesa bastante menos.
  const tipoSalida = archivo.type === "image/png" ? "image/webp" : archivo.type;
  let blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, tipoSalida, calidad));
  // Algunos navegadores (Safari) no codifican WebP y devuelven un PNG enorme: se pasa a JPEG sobre fondo blanco.
  if (blob && tipoSalida === "image/webp" && blob.type !== "image/webp") {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/jpeg", calidad));
  }
  if (!blob) throw new Error("sin blob");
  return new File([blob], archivo.name, { type: blob.type });
}

/** Achica una imagen hasta que entre en una petición (4 MB), probando con menos calidad si hace falta. */
async function comprimirImagen(archivo: File): Promise<File> {
  for (const intento of INTENTOS_DE_COMPRESION) {
    const reducida = await redimensionar(archivo, intento);
    if (reducida.size <= LIMITE_CUERPO_PETICION) return reducida;
  }
  throw new Error("sigue pesando");
}

async function enviar(archivo: File, destino: Destino): Promise<Resultado> {
  const cuerpo = new FormData();
  cuerpo.set("archivo", archivo);
  cuerpo.set("bucket", destino.bucket);
  cuerpo.set("carpeta", destino.carpeta);
  try {
    const res = await fetch("/api/subir", { method: "POST", body: cuerpo });
    const datos = (await res.json().catch(() => null)) as
      | { ok: true; path: string; url: string | null; nombre: string; tamano: number }
      | { ok: false; error: string }
      | null;
    if (res.ok && datos?.ok) return datos;
    if (datos && !datos.ok) return datos;
    return {
      ok: false,
      error: res.status === 413 ? "El archivo es demasiado pesado." : "No pudimos subir el archivo. Probá de nuevo.",
    };
  } catch {
    return { ok: false, error: "No pudimos subir el archivo. Revisá tu conexión y probá de nuevo." };
  }
}

type RespuestaDeSubida =
  | { ok: true; path: string; url: string | null; nombre: string; tamano: number }
  | { ok: false; error: string }
  | null;

/**
 * Un PDF que no entra en una petición de Vercel (más de ~4 MB) se sube directo a Storage con una URL firmada, y el
 * servidor después lo revisa y guarda lo revisado en su carpeta: /api/subir/firmar → Storage → /api/subir/confirmar.
 */
async function enviarGrande(archivo: File, destino: Destino): Promise<Resultado> {
  const fallo: Resultado = { ok: false, error: "No pudimos subir el archivo. Probá de nuevo." };
  const json = { "Content-Type": "application/json" };
  try {
    const pedido = await fetch("/api/subir/firmar", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ carpeta: destino.carpeta, tamano: archivo.size }),
    });
    const firma = (await pedido.json().catch(() => null)) as { ok: true; path: string; token: string } | { ok: false; error: string } | null;
    if (!firma?.ok) return firma ?? fallo;

    const { error } = await crearClienteNavegador()
      .storage.from("privado")
      .uploadToSignedUrl(firma.path, firma.token, archivo, { contentType: MIME_PDF });
    if (error) return { ok: false, error: "No pudimos subir el archivo. Revisá tu conexión y probá de nuevo." };

    const revision = await fetch("/api/subir/confirmar", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ carpeta: destino.carpeta, path: firma.path, nombre: archivo.name }),
    });
    const datos = (await revision.json().catch(() => null)) as RespuestaDeSubida;
    if (revision.ok && datos?.ok) return datos;
    return datos && !datos.ok ? datos : fallo;
  } catch {
    return { ok: false, error: "No pudimos subir el archivo. Revisá tu conexión y probá de nuevo." };
  }
}

function ayudaPorDefecto(tipo: TipoArchivo) {
  const imagen = `JPG, PNG o WebP · hasta ${mb(LIMITE_ORIGINAL_IMAGEN)} MB (la achicamos si hace falta)`;
  const pdf = `PDF · hasta ${mb(LIMITE_PDF)} MB`;
  return tipo === "imagen" ? imagen : tipo === "pdf" ? pdf : `Imagen o PDF · hasta ${mb(LIMITE_PDF)} MB`;
}

const esImagenUrl = (u: string) => /\.(jpe?g|png|webp)(\?|$)/i.test(u);

/**
 * Subida de una imagen o un PDF a Supabase Storage (vía /api/subir), con vista previa, estado de
 * carga y errores. Dentro de un `<form>` aporta un input oculto con el valor resultante.
 * Siempre es opcional para quien lo usa: si el almacenamiento no está configurado se muestra
 * deshabilitado con un texto claro y el resto del formulario funciona igual.
 */
export function SubirArchivo(props: Props) {
  const {
    nombre,
    etiqueta,
    ayuda,
    valorInicial,
    vistaInicial,
    variante = "circulo",
    textoBoton = "Subir archivo",
    titulo = "Arrastrá el archivo aquí o hacé clic para subirlo",
    disponible = Boolean(supabaseUrl()),
    onCambio,
    className,
  } = props;
  const { bucket, carpeta } = props;

  const tipo = tipoDeCarpeta(bucket, carpeta) ?? "imagen";
  const entrada = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(valorInicial ?? "");
  const [vista, setVista] = useState<string | null>(
    vistaInicial ?? (valorInicial && bucket === "publico" && esImagenUrl(valorInicial) ? valorInicial : null),
  );
  const [vistaLocal, setVistaLocal] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState(valorInicial ? nombreDePath(valorInicial) : "");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(
    () => () => {
      if (vistaLocal) URL.revokeObjectURL(vistaLocal);
    },
    [vistaLocal],
  );

  const cambiar = (nuevo: string) => {
    setValor(nuevo);
    onCambio?.(nuevo);
  };

  const procesar = async (original: File | undefined) => {
    if (!original || !disponible) return;
    setError(null);

    const esImagen = (MIME_IMAGEN as readonly string[]).includes(original.type);
    const esPdf = original.type === MIME_PDF;
    if ((!esImagen && !esPdf) || (tipo === "imagen" && !esImagen) || (tipo === "pdf" && !esPdf)) {
      setError(
        tipo === "imagen" ? "Elegí una imagen JPG, PNG o WebP." : tipo === "pdf" ? "Elegí un archivo PDF." : "Elegí una imagen o un PDF.",
      );
      return;
    }
    // Las imágenes se achican antes de subir, así que el tope es el de lo que puede procesar el navegador; un PDF no se
    // puede achicar: hasta ~4 MB va por el servidor y de ahí hasta el máximo se sube directo a Storage.
    const limite = esPdf ? LIMITE_PDF : LIMITE_ORIGINAL_IMAGEN;
    if (original.size > limite) {
      setError(`El archivo pesa ${mb(original.size)} MB; el máximo es ${mb(limite)} MB.`);
      return;
    }

    let archivo = original;
    // Las imágenes del bucket público se vuelven a codificar siempre: así se les saca el EXIF (que puede traer el lugar
    // exacto donde se sacó la foto, y esas URLs son públicas), se aplica la rotación y se limita el tamaño. Las del
    // privado (documentos) se suben tal cual, salvo que no entren en la petición.
    if (esImagen && (bucket === "publico" || archivo.size > LIMITE_CUERPO_PETICION)) {
      try {
        archivo = await comprimirImagen(archivo);
      } catch {
        setError("No pudimos achicar la imagen lo suficiente. Probá con otra o con una captura más liviana.");
        return;
      }
    }
    const directo = esPdf && archivo.size > LIMITE_CUERPO_PETICION;
    if (!directo && archivo.size > LIMITE_CUERPO_PETICION) {
      setError(`El archivo pesa ${mb(archivo.size)} MB; el máximo es ${mb(LIMITE_CUERPO_PETICION)} MB.`);
      return;
    }

    setSubiendo(true);
    const resultado = directo ? await enviarGrande(archivo, props) : await enviar(archivo, props);
    setSubiendo(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    if (esImagen) setVistaLocal(URL.createObjectURL(archivo));
    else setVistaLocal(null);
    setVista(null);
    setArchivoNombre(original.name);
    cambiar(bucket === "publico" ? (resultado.url ?? "") : resultado.path);
  };

  const alElegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    void procesar(archivo);
  };

  const quitar = () => {
    setVistaLocal(null);
    setVista(null);
    setArchivoNombre("");
    setError(null);
    cambiar("");
  };

  const abrirSelector = () => entrada.current?.click();
  const imagenVisible = vistaLocal ?? vista;
  const hayArchivo = valor !== "";
  const accion = hayArchivo ? "Cambiar" : "Subir";
  const ayudaTexto = disponible ? (ayuda ?? ayudaPorDefecto(tipo)) : TEXTO_SIN_ALMACENAMIENTO;

  const input = (
    <>
      <input type="hidden" name={nombre} value={valor} />
      <input
        ref={entrada}
        type="file"
        accept={aceptaDeTipo(tipo)}
        onChange={alElegir}
        disabled={!disponible || subiendo}
        tabIndex={-1}
        aria-hidden
        className="hidden"
      />
    </>
  );

  const estadoTexto = (
    <>
      {subiendo && (
        <p role="status" className="flex items-center gap-2 text-xs text-apagado">
          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
          Subiendo…
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[#b91c1c]">
          {error}
        </p>
      )}
    </>
  );

  if (variante === "boton") {
    return (
      <span className={cn("inline-flex flex-col items-start gap-1", className)}>
        {input}
        <Boton
          tamano="sm"
          variante="secundario"
          onClick={abrirSelector}
          disabled={!disponible || subiendo}
          title={disponible ? undefined : TEXTO_SIN_ALMACENAMIENTO}
          aria-label={etiqueta ? `${hayArchivo ? "Reemplazar" : "Subir"}: ${etiqueta}` : undefined}
          className={cn("flex-none", hayArchivo && "border-verde text-verde")}
        >
          {subiendo ? "Subiendo…" : hayArchivo ? `✓ ${textoBoton}` : textoBoton}
        </Boton>
        {error && (
          <span role="alert" className="max-w-[220px] text-xs leading-snug text-[#b91c1c]">
            {error}
          </span>
        )}
      </span>
    );
  }

  if (variante === "zona") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {etiqueta && <span className="text-xs font-semibold text-apagado">{etiqueta}</span>}
        {input}
        {hayArchivo ? (
          <div className="flex items-center gap-3 rounded-[10px] border border-borde bg-white px-5 py-[18px]">
            <span className="inline-flex size-[34px] flex-none items-center justify-center rounded-lg bg-[#F0EFEA] text-apagado">
              <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
                <path d="M14 3v6h6" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm leading-tight font-semibold text-tinta">{archivoNombre || "Archivo cargado"}</div>
              <div className="mt-0.5 text-xs text-verde">Cargado</div>
            </div>
            <Boton tamano="sm" variante="secundario" onClick={abrirSelector} disabled={subiendo}>
              Reemplazar
            </Boton>
            <Boton tamano="sm" variante="fantasma" onClick={quitar} disabled={subiendo}>
              Quitar
            </Boton>
          </div>
        ) : (
          <button
            type="button"
            onClick={abrirSelector}
            disabled={!disponible || subiendo}
            onDragOver={(e) => {
              if (!disponible) return;
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              void procesar(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "rounded-[10px] border-[1.5px] border-dashed border-[#CFCCC5] px-5 py-9 text-center transition-colors",
              "focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
              disponible ? "cursor-pointer hover:border-navy-700 hover:bg-superficie" : "cursor-not-allowed opacity-60",
              arrastrando && "border-navy-700 bg-superficie",
            )}
          >
            <span className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-[#F0EFEA] text-apagado">
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
              </svg>
            </span>
            <span className="mb-1 block text-sm leading-snug font-semibold text-tinta">{subiendo ? "Subiendo…" : titulo}</span>
            <span className="block text-[13px] leading-snug text-apagado">{ayudaTexto}</span>
          </button>
        )}
        {estadoTexto}
      </div>
    );
  }

  // circulo | banner
  const forma = variante === "circulo" ? "size-[72px] rounded-full" : "h-[120px] w-full rounded-[10px]";
  return (
    <div className={cn("flex flex-col gap-1.5", variante === "circulo" ? "items-start" : "items-stretch", className)}>
      {etiqueta && <span className="text-xs font-semibold text-apagado">{etiqueta}</span>}
      {input}
      <button
        type="button"
        onClick={abrirSelector}
        disabled={!disponible || subiendo}
        aria-label={`${accion} ${etiqueta ?? "imagen"}`}
        className={cn(
          "relative flex flex-none items-center justify-center overflow-hidden border-[1.5px] bg-white text-sutil transition-colors",
          "focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
          forma,
          imagenVisible ? "border-solid border-borde" : "border-dashed border-[#CFCCC5]",
          disponible ? "cursor-pointer hover:border-navy-700" : "cursor-not-allowed opacity-60",
        )}
      >
        {imagenVisible ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de un blob local o de una URL de Storage, sin dimensiones conocidas
          <img src={imagenVisible} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] leading-none font-medium">
            <Icono nombre="mas" tamano={variante === "circulo" ? 16 : 20} />
            {etiqueta}
          </span>
        )}
        {subiendo && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
          </span>
        )}
      </button>
      {hayArchivo && (
        <div className="flex items-center gap-3 text-xs font-medium">
          <button type="button" onClick={abrirSelector} disabled={subiendo} className="text-navy-700 hover:underline">
            Cambiar
          </button>
          <button type="button" onClick={quitar} disabled={subiendo} className="text-sutil hover:text-tinta hover:underline">
            Quitar
          </button>
        </div>
      )}
      <p className="text-xs leading-normal text-sutil">{ayudaTexto}</p>
      {estadoTexto}
    </div>
  );
}
