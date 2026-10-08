import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACIDAD_ACTUALIZADA } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos trata UNIDOAR, para qué los usa, quién los ve y cómo podés ejercer tus derechos.",
};

/*
 * Describe lo que el sistema hace hoy con los datos (visibilidad, documentos, proveedores, cookies). Si cambia el
 * comportamiento (otro proveedor, otra visibilidad, un nuevo uso de los datos), hay que actualizar este texto y la fecha.
 */
const SECCIONES: { id: string; titulo: string; intro?: string; items?: string[]; parrafos?: string[] }[] = [
  {
    id: "datos",
    titulo: "1. Qué datos tratamos",
    intro: "Depende de cómo uses UNIDOAR:",
    items: [
      "Docentes, entrenadores y guardavidas: nombre, email, teléfono, zonas de trabajo, disponibilidad, experiencia, formación, foto y CV. Para verificar tu identidad y tu título también pedimos el DNI (número, CUIL, fecha de nacimiento, domicilio y fotos de ambos lados), tu título o credencial y, si querés, el certificado de buena conducta.",
      "Instituciones: los datos de la institución (nombre, CUIT, dirección, contacto), los de las personas que administran la cuenta, el plan contratado y las facturas.",
      "Tu cuenta: tu email y tu contraseña (la guarda de forma cifrada nuestro proveedor de ingreso: nosotros no la vemos). Si ingresás con Google, el nombre, el email y la foto que Google nos informa. También guardamos cuándo aceptaste los términos y condiciones.",
      "Contactos que cargan las instituciones: una institución puede anotar datos de profesionales que conoce (nombre, email, teléfono, disciplina y una nota). Esos datos los ve solo esa institución. Si figurás en la lista de una institución y querés que se borren, escribinos.",
    ],
  },
  {
    id: "usos",
    titulo: "2. Para qué los usamos",
    items: [
      "Operar el catálogo: mostrar perfiles a las instituciones, publicar búsquedas y gestionar postulaciones, entrevistas y contrataciones.",
      "Verificar la identidad y la formación de docentes, entrenadores y guardavidas (lo hace a mano el equipo de UNIDOAR).",
      "Avisarte lo que pasa en tu cuenta: notificaciones dentro de la app y los mails de cuenta, como la confirmación del email y la recuperación de la contraseña.",
      "Cobrar y facturar los planes de las instituciones.",
      "Cuidar el servicio: seguridad, prevención de abusos y soporte.",
    ],
  },
  {
    id: "quien-ve",
    titulo: "3. Quién ve qué",
    items: [
      "Las instituciones con cuenta ven tu perfil profesional: nombre, foto, zonas, experiencia, formación, CV, disponibilidad y si tu perfil está verificado. Tus datos de contacto (teléfono, email y WhatsApp) los ven cuando te postulás a una de sus búsquedas, les mandás tu CV o te invitan a postularte.",
      "Cuando una institución mira tu perfil, te lo avisamos con una notificación que dice cuál fue (como máximo una por institución y por día).",
      "Tus documentos (DNI, título y certificado de buena conducta) los ve solo el equipo de UNIDOAR, para verificarte. Las instituciones solo ven si tu perfil está verificado, nunca los documentos. Se guardan en un espacio privado y se abren con enlaces temporales.",
      "Tu foto de perfil se guarda en un espacio cuyos enlaces no piden iniciar sesión: quien tenga el enlace puede verla. Antes de guardarla le sacamos los datos de ubicación que pueda traer la imagen.",
      "Los docentes ven lo que cada institución publica en su perfil y en sus búsquedas.",
      "No vendemos tus datos ni los usamos para publicidad de terceros.",
    ],
  },
  {
    id: "proveedores",
    titulo: "4. Proveedores que nos ayudan a operar",
    parrafos: [
      "Para funcionar usamos servicios de terceros que tratan datos por cuenta nuestra: Supabase (base de datos, ingreso a la cuenta y archivos), Vercel (alojamiento de la aplicación) y un servicio de envío de correo para los mails de cuenta. Si elegís ingresar con Google, Google interviene en ese ingreso.",
      "Los datos se guardan en servidores ubicados en São Paulo, Brasil.",
    ],
  },
  {
    id: "cookies",
    titulo: "5. Cookies",
    parrafos: [
      "Usamos solo las cookies necesarias para mantener tu sesión iniciada (y una de muy corta duración mientras te registrás con Google). No usamos cookies de publicidad ni de seguimiento de terceros.",
    ],
  },
  {
    id: "conservacion",
    titulo: "6. Cuánto tiempo los conservamos",
    parrafos: [
      "Mientras tu cuenta esté activa. Si pedís la baja, el equipo de UNIDOAR se contacta con vos para confirmarla y dar de baja tu perfil. Podemos conservar lo que la ley nos obligue a guardar, por ejemplo los registros de facturación.",
    ],
  },
  {
    id: "derechos",
    titulo: "7. Tus derechos",
    parrafos: [
      "Podés acceder a tus datos, corregirlos o pedir que se supriman. Muchos los editás vos mismo: en Mi perfil y en Mi cuenta podés cambiar tus datos, tu email y tu contraseña, y pedir la baja. Para cualquier otra consulta o pedido, escribinos desde la página de contacto.",
      "La Agencia de Acceso a la Información Pública es el organismo de control de la Ley 25.326 de Protección de los Datos Personales y atiende las denuncias y reclamos de quienes vean afectados sus derechos.",
    ],
  },
  {
    id: "cambios",
    titulo: "8. Cambios en esta política",
    parrafos: ["Si la cambiamos, actualizamos la fecha de arriba y, cuando el cambio sea importante, te avisamos."],
  },
];

export default function Privacidad() {
  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-12 py-14 max-[560px]:px-6 max-[560px]:py-10">
      <h1 className="mb-2 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta">Política de privacidad</h1>
      <p className="mb-8 text-sm leading-normal text-sutil">Última actualización: {PRIVACIDAD_ACTUALIZADA}</p>
      <div className="flex flex-col gap-[26px] text-[15px] leading-[1.7] text-tinta-2">
        {SECCIONES.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="mb-2 text-lg leading-[1.3] font-semibold text-tinta">{s.titulo}</h2>
            {s.intro && <p className="mb-2">{s.intro}</p>}
            {s.items && (
              <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
                {s.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {s.parrafos?.map((t) => (
              <p key={t} className="mb-2 last:mb-0">
                {t}
              </p>
            ))}
          </section>
        ))}
        <p>
          ¿Dudas o pedidos sobre tus datos?{" "}
          <Link href="/contacto" className="font-semibold text-naranja">
            Escribinos
          </Link>
          . Las reglas de uso del servicio están en los{" "}
          <Link href="/terminos" className="font-semibold text-naranja">
            términos y condiciones
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
