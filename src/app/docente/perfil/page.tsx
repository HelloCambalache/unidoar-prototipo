import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { AvisoVerificacion } from "@/components/docente/aviso-verificacion";
import { PerfilCompartir } from "@/components/docente/perfil-compartir";
import { PerfilFormulario } from "@/components/docente/perfil-formulario";
import {
  PerfilCompletitud,
  PerfilCursosHechos,
  PerfilVerificacion,
  type DocumentacionPerfil,
  type EstadoDocumento,
  type RequisitoVerificacion,
} from "@/components/docente/perfil-server";
import type { Docente } from "@/db/schema";
import { urlFirmada } from "@/lib/almacenamiento";
import { requerirDocente } from "@/lib/auth";
import { CONSTANCIA, esEstudiante, situacionDeEstudio } from "@/lib/estudiantes";
import { CATEGORIA_ALTA } from "@/lib/onboarding";
import { pendientesDePerfil } from "@/lib/perfil";
import { identidadFija, type DatosPerfil } from "@/lib/perfil-docente";
import { historialCursos } from "@/lib/queries/cursos";
import { origenSitio } from "@/lib/sitio";
import { datosParaPerfil } from "@/lib/queries/docente";

export const metadata: Metadata = { title: "Mi perfil" };

const INSIGNIA: Record<Docente["verificacion"], { texto: string; tono: "verde" | "neutro" | "ambar" | "rosa" }> = {
  verificado: { texto: "Perfil verificado", tono: "verde" },
  pendiente: { texto: "Perfil sin verificar", tono: "neutro" },
  correccion: { texto: "Corregí tu documentación", tono: "ambar" },
  rechazado: { texto: "Verificación rechazada", tono: "rosa" },
};

export default async function PerfilDocentePage() {
  const { usuario, docente } = await requerirDocente();
  const [datos, historial] = await Promise.all([datosParaPerfil(docente), historialCursos(docente.id)]);
  const perfil = pendientesDePerfil(docente);
  const docs = datos.documentos;

  // El CV se guarda como path del bucket privado: la URL para verlo se firma recién ahora.
  const cvEnlace = docente.cvUrl
    ? /^https?:\/\//.test(docente.cvUrl)
      ? docente.cvUrl
      : await urlFirmada(docente.cvUrl)
    : null;

  const estado = (verificado: boolean, subido: boolean): EstadoDocumento =>
    verificado ? "verificado" : subido ? "revision" : "sin";
  const conductaEstado = estado(docente.antecedentesVerificados, !!docs.conducta);
  // A quien todavía cursa no se le pide el título (salvo que ya lo haya subido) sino la constancia de alumno regular.
  const estudiante = esEstudiante(datos.situacionEstudio);
  const credencialPide = !estudiante || !!docs.credencial;
  const constanciaEstado = estado(docente.verificacion === "verificado" && !!docs.constancia, !!docs.constancia);
  const requisitos: RequisitoVerificacion[] = [
    {
      clave: "dni",
      nombre: "Identidad (DNI)",
      estado: estado(docente.verificacion === "verificado", !!docs.dniFrente && !!docs.dniDorso),
    },
    ...(estudiante ? [{ clave: "constancia" as const, nombre: CONSTANCIA.nombre, estado: constanciaEstado }] : []),
    ...(credencialPide
      ? [
          {
            clave: "credencial" as const,
            nombre: CATEGORIA_ALTA[docente.categoria].credencial.nombre,
            estado: estado(docente.tituloVerificado, !!docs.credencial),
          },
        ]
      : []),
    { clave: "conducta", nombre: "Certificado de buena conducta", opcional: true, estado: conductaEstado },
  ];

  // Cargar o corregir la documentación: se puede mientras no esté verificada ni rechazada la verificación.
  const abierta = docente.verificacion !== "rechazado";
  const dniEstado = estado(docente.verificacion === "verificado", !!docs.dniFrente && !!docs.dniDorso);
  const credencialEstado = estado(docente.tituloVerificado, !!docs.credencial);
  const credencial = CATEGORIA_ALTA[docente.categoria].credencial;
  // Con la verificación rechazada no se puede cargar nada desde acá: el texto explica por qué en vez de pedir que se suba.
  const RECHAZADA = "Rechazamos tu verificación: si querés corregir algo, escribinos desde Contacto.";
  const documentacion: DocumentacionPerfil = {
    dni: {
      estado: dniEstado,
      editable: abierta && docente.verificacion !== "verificado",
      detalle:
        dniEstado === "verificado"
          ? "Ya lo verificamos."
          : !abierta
            ? RECHAZADA
            : dniEstado === "revision"
            ? "Lo recibimos y lo estamos revisando."
            : docs.dniFrente
              ? "Falta el dorso."
              : docs.dniDorso
                ? "Falta el frente."
                : "Subí una foto o un PDF de cada lado. Sin esto no podemos verificar tu perfil.",
    },
    credencial: {
      nombre: credencial.nombre,
      estado: credencialEstado,
      editable: abierta && !docente.tituloVerificado,
      detalle:
        credencialEstado === "verificado"
          ? "Ya lo verificamos."
          : !abierta
            ? RECHAZADA
            : credencialEstado === "revision"
              ? "Lo recibimos y lo estamos revisando."
              : credencial.vacio,
    },
    constancia: {
      estado: constanciaEstado,
      editable: abierta && docente.verificacion !== "verificado",
      detalle:
        constanciaEstado === "verificado"
          ? "Ya la revisamos junto con tu DNI."
          : !abierta
            ? RECHAZADA
            : constanciaEstado === "revision"
              ? "La recibimos y la estamos revisando."
              : docente.verificacion === "verificado"
                ? "Todavía no la cargaste: escribinos desde Contacto y la sumamos."
                : `${CONSTANCIA.vacio}. ${CONSTANCIA.corto}.`,
    },
    // Quien se recibió y ya está verificado no vuelve a "estudiando" desde acá; con la verificación rechazada lo atiende el equipo.
    estudiosEditables: abierta && (estudiante || docente.verificacion !== "verificado"),
  };

  const inicial: DatosPerfil = {
    nombre: docente.nombre,
    apellido: docente.apellido,
    subtitulo: docente.subtitulo ?? "",
    resumen: docente.resumen ?? "",
    telefono: docente.telefono ?? "",
    aniosExperiencia: docente.aniosExperiencia,
    radioKm: docente.radioKm,
    zonas: docente.zonas,
    asignaturas: docente.asignaturas,
    niveles: docente.niveles,
    experiencia: docente.experiencia,
    formacion: docente.formacion,
    grilla: datos.grilla,
    fotoUrl: docente.fotoUrl ?? "",
    cvUrl: docente.cvUrl ?? "",
    conducta: docs.conducta ?? "",
    dniFrente: docs.dniFrente ?? "",
    dniDorso: docs.dniDorso ?? "",
    credencial: docs.credencial ?? "",
    constancia: docs.constancia ?? "",
    situacionEstudio: situacionDeEstudio(datos.situacionEstudio),
    porcentajeMaterias: datos.porcentajeMaterias != null ? String(datos.porcentajeMaterias) : "",
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Mi perfil"
        bajada="Es lo que ven las instituciones cuando te buscan o te postulás. Guardá cuando termines."
      />
      <AvisoVerificacion verificacion={docente.verificacion} nota={docente.verificacionNota} />
      <PerfilFormulario
        inicial={inicial}
        identidadFija={identidadFija(docente)}
        insignia={INSIGNIA[docente.verificacion]}
        emailCuenta={usuario.email}
        sugerencias={{ zonas: datos.zonas, asignaturas: datos.asignaturas }}
        cvEnlace={cvEnlace}
        conductaEstado={conductaEstado}
        documentacion={documentacion}
        verificacion={<PerfilVerificacion requisitos={requisitos} />}
        cursosHechos={<PerfilCursosHechos cursos={historial} />}
        lateral={<PerfilCompletitud perfil={perfil} />}
        compartir={<PerfilCompartir tokenInicial={docente.compartirToken} origen={await origenSitio()} />}
      />
    </>
  );
}
