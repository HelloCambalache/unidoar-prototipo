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
      "Educadores, entrenadores y guardavidas: nombre, email, teléfono, zonas de trabajo, disponibilidad, experiencia, formación, foto y CV. Para verificar tu identidad y tu título también pedimos el DNI (número, CUIL, fecha de nacimiento, domicilio y fotos de ambos lados), tu título o credencial y, si querés, el certificado de buena conducta. Si todavía estudiás, en lugar del título te pedimos la constancia de alumno regular y qué porcentaje de las materias ya aprobaste.",
      "Instituciones: los datos de la institución (nombre, CUIT, dirección, contacto), los de las personas que administran la cuenta, el plan contratado y las facturas. Si la institución activa el débito automático, guardamos el número de su suscripción en Mercado Pago, el estado del débito, el historial de cobros (fecha, monto y si se cobró o fue rechazado) y, si Mercado Pago nos lo informa, el mail de la cuenta con la que paga; nunca los datos de su tarjeta, que se cargan y quedan solo en Mercado Pago. Si una institución recomienda UNIDOAR a otra con su enlace de referidos, guardamos quién recomendó a quién, cuándo y si ya se aplicó el beneficio por recomendar; la que recomendó ve el nombre de las instituciones que recomendó y en qué paso está cada una.",
      "Tu cuenta: tu email y tu contraseña (la guarda de forma cifrada nuestro proveedor de ingreso: nosotros no la vemos). Si ingresás con Google, el nombre, el email y la foto que Google nos informa: la foto la copiamos a nuestro propio espacio de archivos, así tu perfil no depende de un enlace de Google. También guardamos cuándo aceptaste los términos y condiciones.",
      "Examen preocupacional: si una institución te lo pide antes de que ingreses a trabajar, anota en tu postulación que lo hiciste y la fecha, y puede guardar el archivo del estudio (PDF o foto). Es información de salud: queda en un espacio privado, la ve solo esa institución y se abre con un enlace que comprueba que sea de su equipo. Vos ves en tu postulación si el examen figura como pendiente o realizado.",
      "Contactos que cargan las instituciones: una institución puede anotar datos de profesionales que conoce (nombre, email, teléfono, disciplina y una nota). Esos datos los ve solo esa institución. Si figurás en la lista de una institución y querés que se borren, escribinos.",
    ],
  },
  {
    id: "usos",
    titulo: "2. Para qué los usamos",
    items: [
      "Operar el catálogo: mostrar perfiles a las instituciones, publicar búsquedas y gestionar postulaciones, entrevistas y contrataciones.",
      "Verificar la identidad y la formación de educadores, entrenadores y guardavidas (lo hace a mano el equipo de UNIDOAR).",
      "Avisarte lo que pasa en tu cuenta: notificaciones dentro de la app y mails, como la confirmación del email, la recuperación de la contraseña, el resultado de la verificación de tu perfil, las invitaciones, entrevistas y ofertas de las búsquedas, y las facturas de los planes. Los avisos de búsquedas y postulaciones los podés desactivar desde Mi cuenta o con el enlace que viene al pie de cada mail; los de cuenta, verificación y facturación no se pueden desactivar porque son parte del servicio.",
      "Cobrar y facturar los planes de las instituciones, también con el débito automático mensual si la institución lo elige.",
      "Cuidar el servicio: seguridad, prevención de abusos y soporte.",
    ],
  },
  {
    id: "quien-ve",
    titulo: "3. Quién ve qué",
    items: [
      "Las instituciones con cuenta ven tu perfil profesional: nombre, foto, zonas, experiencia, formación, disponibilidad y si tu perfil está verificado. Si todavía estudiás, también ven que sos estudiante y el porcentaje de la carrera que declaraste. Tus datos de contacto (teléfono, email y WhatsApp) y tu CV, que suele traerlos, los ven cuando te postulás a una de sus búsquedas o les mandás tu CV. Si una institución te invita a postularte, no ve tus datos de contacto ni tu CV hasta que te postulás.",
      "Cuando una institución mira tu perfil, te lo avisamos con una notificación que dice cuál fue (como máximo una por institución y por día).",
      "Compartir mi perfil: viene apagado. Si lo prendés desde Mi perfil, tu perfil tiene una página con un enlace largo que no se puede adivinar, y cualquiera que tenga ese enlace la puede ver sin iniciar sesión: tu nombre, foto, zonas, experiencia, formación, asignaturas y si tu perfil está verificado. Nunca incluye tu teléfono, tu email, tu CV ni tus documentos, y no la indexan los buscadores. Si lo apagás, el enlace deja de funcionar para siempre (si lo prendés de nuevo, se crea otro).",
      "Tus documentos (DNI, título o constancia de alumno regular, y certificado de buena conducta) los ve solo el equipo de UNIDOAR, para verificarte. Las instituciones solo ven si tu perfil está verificado, nunca los documentos. Se guardan en un espacio privado y se abren con enlaces temporales. Las fotos de tu DNI se eliminan dentro de las 24 horas de que verificamos tu identidad: el plazo empieza a correr con la verificación (hasta entonces las conservamos para poder revisarlas) y, de tu DNI, solo conservamos el número, como constancia de lo que verificamos.",
      "Tu foto de perfil se guarda en un espacio cuyos enlaces no piden iniciar sesión: quien tenga el enlace puede verla. Antes de guardarla le sacamos los datos de ubicación que pueda traer la imagen.",
      "Los profesionales ven lo que cada institución publica en su perfil y en sus búsquedas. El perfil público de una institución y cada búsqueda abierta tienen su propia dirección y se pueden compartir (por WhatsApp, redes o mail): cualquiera que tenga el enlace los puede ver sin iniciar sesión —la descripción de la búsqueda, sus requisitos y lo que ofrece—, y nunca ve quiénes se postularon ni datos de contacto. Cuando una búsqueda se cierra o se pausa, su enlace pasa a decir que ya no está abierta y deja de mostrar el detalle.",
      "No vendemos tus datos ni los usamos para publicidad de terceros.",
    ],
  },
  {
    id: "proveedores",
    titulo: "4. Proveedores que nos ayudan a operar",
    parrafos: [
      "Para funcionar usamos servicios de terceros que tratan datos por cuenta nuestra: Supabase (base de datos, ingreso a la cuenta y archivos), Vercel (alojamiento de la aplicación) y un servicio de envío de correo para los mails de cuenta, de avisos y de facturación. Si elegís ingresar con Google, Google interviene en ese ingreso. Si una institución elige pagar con débito automático, Mercado Pago procesa el cobro de su plan: la tarjeta se carga en el sitio de Mercado Pago, no pasa por nuestros servidores, y Mercado Pago nos informa si cada cobro se hizo para que registremos el pago; a Mercado Pago le enviamos el monto del plan y el nombre del plan y de la institución, para que quien se suscribe sepa qué está autorizando; el mail, la cuenta y la tarjeta los carga la persona directamente en Mercado Pago.",
      "Para ubicar en el mapa las direcciones que se cargan al escribirlas (las de las instituciones, de cada una de sus sedes, y las de sus cursos presenciales, que son las que la institución publica) las consultamos en Georef, el servicio de datos abiertos del Estado argentino y, si ahí no aparece, en OpenStreetMap. El domicilio de las personas se consulta solo en Georef, nunca en OpenStreetMap, y lo usamos únicamente para completar el partido y la provincia: no se usa para calcular distancias ni se muestra a las instituciones. A esos servicios les llega el texto de la dirección desde nuestros servidores, sin tu nombre ni los datos de tu cuenta.",
      "Los datos se guardan en servidores ubicados en São Paulo, Brasil.",
    ],
  },
  {
    id: "cookies",
    titulo: "5. Cookies",
    parrafos: [
      "Usamos solo las cookies necesarias para mantener tu sesión iniciada (y una de muy corta duración mientras te registrás con Google). Si entrás por el enlace de referidos de una institución, guardamos durante 30 días una cookie con su código, solo para anotar quién te recomendó cuando creás tu cuenta de institución. No usamos cookies de publicidad ni de seguimiento de terceros.",
    ],
  },
  {
    id: "conservacion",
    titulo: "6. Cuánto tiempo los conservamos",
    parrafos: [
      "Mientras tu cuenta esté activa. Si pedís la baja, el equipo de UNIDOAR se contacta con vos para confirmarla; al procesarla se borran tu perfil, tus documentos, tus postulaciones y tu usuario de acceso. En el caso de una institución se borran su equipo y las cuentas de acceso, sus búsquedas con las postulaciones, los cursos, los contactos que cargó, sus recomendaciones de referidos, la suscripción de débito automático (que se cancela en Mercado Pago antes de la baja), el perfil público y los archivos. Conservamos lo que la ley nos obliga a guardar: de una institución, su nombre, CUIT y domicilio, sus facturas y el historial de los cobros del débito automático (los registros de facturación).",
      "De los mails que te enviamos guardamos un registro (a quién, de qué tipo y su contenido) durante 90 días, para poder reintentar un envío fallido y resolver reclamos.",
    ],
  },
  {
    id: "derechos",
    titulo: "7. Tus derechos",
    parrafos: [
      "Podés acceder a tus datos, corregirlos o pedir que se supriman. Muchos los editás vos mismo: en Mi perfil y en Mi cuenta podés cambiar tus datos y tu contraseña, y pedir la baja. El email con el que ingresás no se cambia desde la app: si necesitás usar otro, escribinos desde la página de contacto, que también es el camino para cualquier otra consulta o pedido.",
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
