import Link from "next/link";
import { DocInsigniaSuspendida, DocInsigniaVerificacion } from "@/components/backoffice/doc-insignias";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { cuilLegible, dniLegible, type DocumentoBo } from "@/lib/backoffice-docentes";
import { CATEGORIA_INFO, ETAPA_LABEL } from "@/lib/catalogo";
import { fechaCorta, haceTiempo } from "@/lib/fechas";
import type { FichaDocenteBo } from "@/lib/queries/backoffice-docentes";
import { cn, iniciales } from "@/lib/utils";

/* Piezas de la ficha de un docente del backoffice. Todo se renderiza en el servidor. */

const TONO_ETAPA = {
  nuevos: "azul",
  preseleccionados: "azul",
  entrevista: "ambar",
  oferta: "naranja",
  examen_preocupacional: "ambar",
  contratado: "verde",
  descartado: "neutro",
} as const;

const nombreCompleto = (f: FichaDocenteBo) => `${f.docente.nombre} ${f.docente.apellido}`.trim();

/** Foto, nombre, estado de verificación y, si hubo corrección o rechazo, el motivo que se le comunicó. */
export function DocCabecera({ ficha }: { ficha: FichaDocenteBo }) {
  const d = ficha.docente;
  const info = CATEGORIA_INFO[d.categoria];
  const nombre = nombreCompleto(ficha);
  const resumen = [d.asignaturas.slice(0, 2).join(", ") || d.subtitulo || info.label, d.zonas.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join(" · ");
  const conNota = (d.verificacion === "correccion" || d.verificacion === "rechazado") && d.verificacionNota;

  return (
    <Tarjeta como="section" className="p-[22px]">
      <div className="flex flex-wrap items-center gap-[18px]">
        <Avatar iniciales={iniciales(nombre)} fotoUrl={d.fotoUrl} tamano={72} fondo={info.tint} texto={info.ink} />
        <div className="min-w-[200px] flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.015em]">{nombre}</h1>
            <DocInsigniaVerificacion estado={d.verificacion} />
            {d.suspendido && <DocInsigniaSuspendida />}
            {ficha.bajaSolicitadaEn && <Insignia tono="ambar">Baja solicitada</Insignia>}
          </div>
          <div className="text-sm leading-snug text-apagado">{resumen}</div>
          <div className="mt-1 text-xs leading-snug text-sutil">{info.label}</div>
        </div>
      </div>
      {ficha.bajaSolicitadaEn && (
        <div role="status" className="mt-4 rounded-lg border border-[#EBD9A8] bg-[#FBF2D8] px-3.5 py-2.5 text-[13px] leading-normal text-[#7A5A0B]">
          <b className="font-semibold">Pidió la baja de la cuenta</b> el {fechaCorta(ficha.bajaSolicitadaEn)}. Hay que escribirle a{" "}
          {ficha.emailCuenta ?? d.email ?? "su email"} para confirmarla y dar de baja el perfil. Hasta entonces la cuenta sigue
          funcionando igual.
        </div>
      )}
      {conNota && (
        <div
          className={cn(
            "mt-4 rounded-lg px-3.5 py-2.5 text-[13px] leading-normal",
            d.verificacion === "rechazado" ? "bg-rosa-tint text-rosa" : "bg-[#FEF1DF] text-[#8A4B07]",
          )}
        >
          <b className="font-semibold">{d.verificacion === "rechazado" ? "Motivo del rechazo" : "Corrección pedida"}:</b>{" "}
          {d.verificacionNota}
          {d.verificacionRevisadaEn && <span className="opacity-80"> ({fechaCorta(d.verificacionRevisadaEn)})</span>}
        </div>
      )}
    </Tarjeta>
  );
}

/** Postulaciones, contrataciones y scoring interno en una tira. */
export function DocMetricas({ ficha }: { ficha: FichaDocenteBo }) {
  const celdas = [
    { valor: ficha.postulaciones, etiqueta: "Postulaciones" },
    { valor: ficha.contrataciones, etiqueta: "Contrataciones" },
    { valor: ficha.scoring.total, etiqueta: "Scoring interno" },
  ];
  return (
    <dl className="m-0 grid overflow-hidden rounded-ud border border-borde bg-white [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
      {celdas.map((c) => (
        <div key={c.etiqueta} className="border-r border-borde px-[18px] py-4 last:border-r-0">
          <dd className="m-0 text-[22px] leading-none font-semibold text-navy-700 tabular-nums">{c.valor}</dd>
          <dt className="mt-1.5 text-xs leading-snug text-apagado">{c.etiqueta}</dt>
        </div>
      ))}
    </dl>
  );
}

export function DocPostulaciones({ ficha }: { ficha: FichaDocenteBo }) {
  return (
    <Tarjeta como="section" className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Postulaciones recientes</EtiquetaSeccion>
      {ficha.recientes.length === 0 ? (
        <p className="m-0 text-sm leading-normal text-apagado">Todavía no se postuló ni fue invitado a ninguna búsqueda.</p>
      ) : (
        <Tabla className="min-w-[480px]">
          <thead>
            <tr>
              <th>Búsqueda</th>
              <th>Institución</th>
              <th>Fecha</th>
              <th>Etapa</th>
            </tr>
          </thead>
          <tbody>
            {ficha.recientes.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">
                  {p.busqueda}
                  {p.origen === "invitacion" && <span className="ml-1.5 text-xs font-normal text-sutil">(invitación)</span>}
                </td>
                <td>
                  <Link href={`/backoffice/instituciones/${p.institucionId}`} className="text-tinta hover:text-navy-700 hover:underline">
                    {p.institucion}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-apagado">{fechaCorta(p.creadaEn)}</td>
                <td>
                  <Insignia tono={TONO_ETAPA[p.etapa]}>{ETAPA_LABEL[p.etapa]}</Insignia>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Tarjeta>
  );
}

type EstadoDoc = { texto: string; clase: string };
const ESTADO = {
  validado: { texto: "Validado", clase: "text-verde" },
  revision: { texto: "Pendiente de revisión", clase: "text-[#7A5900]" },
  incompleto: { texto: "Incompleto", clase: "text-[#7A5900]" },
  sin: { texto: "Sin cargar", clase: "text-sutil" },
  noAplica: { texto: "No aplica", clase: "text-sutil" },
  cargado: { texto: "Cargado", clase: "text-tinta-2" },
} satisfies Record<string, EstadoDoc>;

function Enlaces({ docs }: { docs: { etiqueta: string; d: DocumentoBo | undefined }[] }) {
  const con = docs.filter((x) => x.d?.url);
  if (con.length === 0) return null;
  return (
    <>
      {con.map((x) => (
        <a
          key={x.etiqueta}
          href={x.d!.url!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${x.d!.etiqueta} en una pestaña nueva`}
          className="text-[13px] font-medium text-navy-700 hover:underline"
        >
          {x.etiqueta} ↗
        </a>
      ))}
    </>
  );
}

/** Documentación y su estado: identidad, título, antecedentes y CV, con enlaces firmados a los archivos. */
export function DocDocumentacion({ ficha }: { ficha: FichaDocenteBo }) {
  const { docente: d, identidad } = ficha;
  const doc = (clave: DocumentoBo["clave"]) => ficha.documentos.find((x) => x.clave === clave);
  const frente = doc("dniFrente");
  const dorso = doc("dniDorso");
  const credencial = doc("credencial");
  const conducta = doc("conducta");
  const cv = doc("cv");

  const identidadValidada = d.verificacion === "verificado";
  const dni: EstadoDoc =
    frente?.subido && dorso?.subido ? (identidadValidada ? ESTADO.validado : ESTADO.revision) : frente?.subido || dorso?.subido ? ESTADO.incompleto : ESTADO.sin;
  const cuil: EstadoDoc = identidad.cuil ? (identidadValidada ? ESTADO.validado : ESTADO.revision) : ESTADO.sin;
  const titulo: EstadoDoc = credencial?.noAplica
    ? ESTADO.noAplica
    : credencial?.subido
      ? d.tituloVerificado
        ? ESTADO.validado
        : ESTADO.revision
      : ESTADO.sin;
  const buenaConducta: EstadoDoc = conducta?.subido ? (d.antecedentesVerificados ? ESTADO.validado : ESTADO.revision) : ESTADO.sin;
  const curriculum: EstadoDoc = cv?.subido ? ESTADO.cargado : ESTADO.sin;

  const filas: { clave: string; etiqueta: string; detalle?: string; estado: EstadoDoc; enlaces?: React.ReactNode }[] = [
    {
      clave: "dni",
      etiqueta: "DNI (frente y dorso)",
      detalle: identidad.dni ? `N.º ${dniLegible(identidad.dni)}` : "Número sin cargar",
      estado: dni,
      enlaces: <Enlaces docs={[{ etiqueta: "Frente", d: frente }, { etiqueta: "Dorso", d: dorso }]} />,
    },
    { clave: "cuil", etiqueta: "CUIL", detalle: identidad.cuil ? cuilLegible(identidad.cuil) : undefined, estado: cuil },
    {
      clave: "credencial",
      etiqueta: credencial?.etiqueta ?? "Título",
      estado: titulo,
      enlaces: <Enlaces docs={[{ etiqueta: "Ver", d: credencial }]} />,
    },
    {
      clave: "conducta",
      etiqueta: "Certificado de buena conducta",
      estado: buenaConducta,
      enlaces: <Enlaces docs={[{ etiqueta: "Ver", d: conducta }]} />,
    },
    { clave: "cv", etiqueta: "CV (PDF)", estado: curriculum, enlaces: <Enlaces docs={[{ etiqueta: "Descargar", d: cv }]} /> },
  ];

  const enCola = d.onboardingCompleto && (d.verificacion === "pendiente" || d.verificacion === "correccion");

  return (
    <Tarjeta como="section" className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Documentación</EtiquetaSeccion>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm leading-snug text-tinta-2">
        {filas.map((f) => (
          <li key={f.clave} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span>
              {f.etiqueta}
              {f.detalle && <span className="ml-2 text-xs text-sutil">{f.detalle}</span>}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              {f.enlaces}
              <span className={cn("font-medium", f.estado.clase)}>{f.estado.texto}</span>
            </span>
          </li>
        ))}
      </ul>
      {ficha.faltantes.length > 0 && (
        <p className="m-0 mt-4 rounded-lg bg-[#FEF1DF] px-3.5 py-2.5 text-[13px] leading-normal text-[#8A4B07]">
          <b className="font-semibold">Falta:</b> {ficha.faltantes.join(" · ")}
        </p>
      )}
      {enCola && (
        <Link href={`/backoffice/verificacion#d-${d.id}`} className="mt-4 inline-block text-[13px] font-medium text-navy-700 hover:underline">
          Revisar en la cola de verificación →
        </Link>
      )}
    </Tarjeta>
  );
}

const dec = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** Cómo se compone el scoring interno (para que el número no sea una caja negra). */
export function DocScoring({ ficha }: { ficha: FichaDocenteBo }) {
  return (
    <Tarjeta como="section" className="p-[22px]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <EtiquetaSeccion className="mb-0">Cómo se compone el scoring</EtiquetaSeccion>
        <span className="text-xs leading-none text-sutil">Interno: nunca lo ven profesionales ni instituciones</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {ficha.scoring.partes.map((p) => (
          <li key={p.clave} className="flex items-center gap-3 text-[13px] leading-none">
            <span className="w-[120px] flex-none text-tinta-2">{p.etiqueta}</span>
            <span
              role="progressbar"
              aria-label={p.etiqueta}
              aria-valuemin={0}
              aria-valuemax={p.maximo}
              aria-valuenow={p.puntos}
              className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0EFEA]"
            >
              <span className="block h-full rounded-full bg-navy-700" style={{ width: `${(p.puntos / p.maximo) * 100}%` }} />
            </span>
            <span className="w-[64px] flex-none text-right font-semibold tabular-nums">
              {dec.format(p.puntos)} / {p.maximo}
            </span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function DocContacto({ ficha }: { ficha: FichaDocenteBo }) {
  const d = ficha.docente;
  const emails = [...new Set([d.email, ficha.emailCuenta].filter((e): e is string => !!e))];
  return (
    <Tarjeta como="section" className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Contacto</EtiquetaSeccion>
      <div className="flex flex-col gap-1 text-sm leading-[1.6] text-tinta-2">
        {emails.map((e) => (
          <a key={e} href={`mailto:${e}`} className="break-all text-tinta-2 hover:text-navy-700 hover:underline">
            {e}
          </a>
        ))}
        {d.telefono ? <span>{d.telefono}</span> : <span className="text-sutil">Sin teléfono cargado</span>}
        {emails.length === 0 && <span className="text-sutil">Sin email cargado</span>}
      </div>
      {d.zonas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.zonas.map((z) => (
            <Insignia key={z}>{z}</Insignia>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

/** Los pasos de `pendientesDePerfil` están redactados para el docente ("tu CV"): acá se nombran en neutro. La verificación no entra: tiene su propia sección. */
const ETIQUETA_PASO: Record<string, string> = {
  foto: "foto",
  resumen: "resumen",
  telefono: "teléfono",
  zonas: "zonas",
  asignaturas: "asignaturas",
  disponibilidad: "disponibilidad",
  niveles: "niveles",
  experiencia: "experiencia",
  formacion: "formación",
  cv: "CV",
};

const MES_ANIO = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

/** Alta, última actividad (notificación o postulación), % de perfil completo y estado de la cuenta. */
export function DocCuenta({ ficha }: { ficha: FichaDocenteBo }) {
  const d = ficha.docente;
  const faltaCargar = ficha.perfil.pendientes.flatMap((p) => (ETIQUETA_PASO[p.clave] ? [ETIQUETA_PASO[p.clave]!] : []));
  const filas: { etiqueta: string; valor: React.ReactNode }[] = [
    { etiqueta: "Alta", valor: MES_ANIO.format(d.creadoEn) },
    { etiqueta: "Última actividad", valor: ficha.ultimaActividad ? haceTiempo(ficha.ultimaActividad) : "Sin actividad" },
    { etiqueta: "Perfil completo", valor: `${ficha.perfil.porcentaje}%` },
    { etiqueta: "Cuenta de acceso", valor: d.usuarioId ? "Sí" : "No (perfil sin cuenta)" },
    {
      etiqueta: "Términos aceptados",
      valor: ficha.terminos ? `v${ficha.terminos.version} · ${fechaCorta(ficha.terminos.en)}` : d.usuarioId ? "Sin constancia" : "—",
    },
    { etiqueta: "Estado", valor: d.suspendido ? <span className="text-rosa">Suspendida</span> : "Activa" },
  ];
  return (
    <Tarjeta como="section" className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Cuenta</EtiquetaSeccion>
      <dl className="m-0 flex flex-col gap-2 text-[13px] leading-snug">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex justify-between gap-3">
            <dt className="text-apagado">{f.etiqueta}</dt>
            <dd className="m-0 text-right text-tinta">{f.valor}</dd>
          </div>
        ))}
      </dl>
      {faltaCargar.length > 0 && (
        <p className="m-0 mt-3 text-xs leading-normal text-sutil">
          Le falta cargar: {faltaCargar.slice(0, 5).join(", ")}
          {faltaCargar.length > 5 && ` y ${faltaCargar.length - 5} más`}.
        </p>
      )}
    </Tarjeta>
  );
}
