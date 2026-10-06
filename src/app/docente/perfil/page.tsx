import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { AvisoVerificacion } from "@/components/docente/aviso-verificacion";
import { PerfilFormulario } from "@/components/docente/perfil-formulario";
import {
  PerfilCompletitud,
  PerfilCursosHechos,
  PerfilVerificacion,
  type EstadoDocumento,
  type RequisitoVerificacion,
} from "@/components/docente/perfil-server";
import type { Docente } from "@/db/schema";
import { urlFirmada } from "@/lib/almacenamiento";
import { requerirDocente } from "@/lib/auth";
import { CATEGORIA_ALTA } from "@/lib/onboarding";
import { pendientesDePerfil } from "@/lib/perfil";
import type { DatosPerfil } from "@/lib/perfil-docente";
import { historialCursos } from "@/lib/queries/cursos";
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
  const requisitos: RequisitoVerificacion[] = [
    { clave: "dni", nombre: "Identidad (DNI)", estado: estado(docente.verificacion === "verificado", !!docs.dniFrente) },
    {
      clave: "credencial",
      nombre: CATEGORIA_ALTA[docente.categoria].credencial.nombre,
      estado: estado(docente.tituloVerificado, !!docs.credencial),
    },
    { clave: "conducta", nombre: "Certificado de buena conducta", opcional: true, estado: conductaEstado },
  ];

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
  };

  return (
    <>
      <EncabezadoPagina titulo="Mi perfil" />
      <AvisoVerificacion verificacion={docente.verificacion} nota={docente.verificacionNota} />
      <PerfilFormulario
        inicial={inicial}
        insignia={INSIGNIA[docente.verificacion]}
        emailCuenta={usuario.email}
        sugerencias={{ zonas: datos.zonas, asignaturas: datos.asignaturas }}
        cvEnlace={cvEnlace}
        conductaEstado={conductaEstado}
        verificacion={<PerfilVerificacion requisitos={requisitos} />}
        cursosHechos={<PerfilCursosHechos cursos={historial} />}
        lateral={<PerfilCompletitud perfil={perfil} />}
      />
    </>
  );
}
