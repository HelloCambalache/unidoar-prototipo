import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLANTILLAS, armarMail, esGrupoOpcional, esPlantilla, escaparHtml, limpiarAsunto, urlInterna, type DatosDe, type PlantillaId } from "./plantillas";

const ORIGEN = "https://unidoar.com.ar";

/** Un dato de ejemplo por plantilla: si alguna deja de armarse, la prueba de abajo lo avisa. */
const EJEMPLOS: { [P in PlantillaId]: DatosDe[P] } = {
  M06: { institucion: "Colegio San Martín", rol: "Administrador", invitadoPor: "Ana", email: "nuevo@colegio.edu.ar", ruta: "/invitacion/3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c" },
  M11: { nombre: "Lucía" },
  M12: { nombre: "Lucía", motivo: "El DNI se ve borroso.\nSubilo de nuevo." },
  M13: { nombre: "Lucía", motivo: "No coincide el nombre." },
  M15: { nombre: "Lucía", institucion: null, motivo: "Datos falsos" },
  M16: { nombre: "Lucía", institucion: null },
  M20: { institucion: "Club Atlético", puesto: "Profesor de natación", ruta: "/docente/buscar-trabajo" },
  M21: { institucion: "Club Atlético", puesto: "Suplencia de matemática", zona: "Quilmes", plazo: "jueves 8 de octubre", ruta: "/docente/buscar-trabajo" },
  M23: { institucion: "Club Atlético", puesto: "Profesor", ruta: "/docente/postulaciones?abrir=1" },
  M24: { institucion: "Club Atlético", puesto: "Profesor", cuando: "jueves, 8 de octubre, 10:30 hs", titulo: "Entrevista con dirección", ruta: "/docente/postulaciones?abrir=1" },
  M25: { institucion: "Club Atlético", puesto: "Profesor", ruta: "/docente/postulaciones?abrir=1" },
  M26: { institucion: "Club Atlético", puesto: "Profesor", ruta: "/docente/postulaciones?abrir=1" },
  M27: { institucion: "Club Atlético", puesto: "Profesor", inicio: "01/03/2027", ruta: "/docente/postulaciones?abrir=1" },
  M30: { busqueda: "Profesor de natación", rapida: false, ruta: "/institucion/postulantes?busqueda=1" },
  M35: { profesional: "Lucía Pérez", puesto: "Profesor de natación", respuesta: "voy", cuando: "jueves, 8 de octubre, 10:30 hs", mensaje: null, ruta: "/institucion/postulantes?busqueda=1" },
  M50: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000", vence: "10 oct 2026" },
  M51: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000", vence: "10 oct 2026" },
  M52: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000", vencio: "10 oct 2026", segundoAviso: false, ultimoDiaDeGracia: "25 oct 2026" },
  M53: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000" },
  M54: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000" },
  M55: { institucion: "Club Atlético", plan: "Pro" },
  M56: { institucion: "Club Atlético", plan: "Pro", aprobado: true, nota: null, detalle: null },
  M58: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000" },
  M60: { nombre: "Marta", email: "marta@example.com", rol: "Institución", mensaje: "Hola, quiero consultar un precio." },
  M61: { docente: "Lucía Pérez", detalle: "subió documentación para revisar.", ruta: "/backoffice/verificacion" },
  M62: { cuenta: "Lucía Pérez", tipo: "docente", ruta: "/backoffice/docentes" },
  M63: { institucion: "Club Atlético", plan: "Pro", ruta: "/backoffice/cobros" },
  M67: { institucion: "Club Atlético", total: "$ 250.000", meses: 6, alCrearLaCuenta: false, ruta: "/backoffice/cobros/abc" },
  M68: { institucion: "Club Atlético", limitada: false, periodo: "Octubre de 2026", monto: "$ 45.000", vencio: "10 oct 2026", ultimoDiaDeGracia: "25 oct 2026" },
};

describe("plantillas de mails", () => {
  it("todas las plantillas tienen un ejemplo y se arman con asunto, HTML y texto", () => {
    for (const id of Object.keys(PLANTILLAS) as PlantillaId[]) {
      assert.ok(id in EJEMPLOS, `falta el ejemplo de ${id}`);
      const mail = armarMail(id, EJEMPLOS[id] as never, { origen: ORIGEN, rutaDeBaja: "/avisos/baja?u=x&t=y" });
      assert.ok(mail.asunto.length > 5 && mail.asunto.length <= 150, `${id}: asunto`);
      assert.ok(mail.html.startsWith("<!doctype html>"), `${id}: html`);
      assert.ok(mail.texto.length > 20, `${id}: texto`);
      assert.ok(!/\bundefined\b|\[object Object\]|\bnull\b/.test(mail.texto), `${id}: el texto muestra un valor vacío:\n${mail.texto}`);
      assert.ok(!/\bundefined\b|\[object Object\]/.test(mail.html), `${id}: el html muestra un valor vacío`);
    }
  });

  it("solo la baja de avisos aparece en los mails opcionales", () => {
    const contratacion = armarMail("M24", EJEMPLOS.M24, { origen: ORIGEN, rutaDeBaja: "/avisos/baja?u=1&t=2" });
    assert.equal(contratacion.urlDeBaja, `${ORIGEN}/avisos/baja?u=1&t=2`);
    assert.ok(contratacion.html.includes("Dejar de recibir avisos por mail"));
    assert.ok(contratacion.texto.includes("Dejar de recibir avisos por mail:"));

    for (const id of ["M06", "M12", "M50", "M60"] as const) {
      const mail = armarMail(id, EJEMPLOS[id] as never, { origen: ORIGEN, rutaDeBaja: "/avisos/baja?u=1&t=2" });
      assert.equal(mail.urlDeBaja, null, id);
      assert.ok(!mail.html.includes("Dejar de recibir"), id);
    }
    // Sin firma disponible, el mail opcional sale sin el enlace de baja (no se rompe).
    assert.equal(armarMail("M24", EJEMPLOS.M24, { origen: ORIGEN }).urlDeBaja, null);
  });

  it("los grupos opcionales son solo los de contratación", () => {
    const opcionales = (Object.keys(PLANTILLAS) as PlantillaId[]).filter((id) => esGrupoOpcional(PLANTILLAS[id].grupo));
    assert.deepEqual(opcionales, ["M20", "M21", "M23", "M24", "M25", "M26", "M27", "M30", "M35"]);
    for (const id of ["M11", "M12", "M13", "M15", "M16", "M06"] as const) assert.equal(PLANTILLAS[id].grupo, "cuenta");
    for (const id of ["M50", "M51", "M52", "M53", "M54", "M55", "M56", "M68"] as const) {
      assert.equal(PLANTILLAS[id].grupo, "facturacion");
      assert.equal(PLANTILLAS[id].remitente, "facturacion");
    }
    for (const id of ["M60", "M61", "M62", "M63", "M67"] as const) assert.equal(PLANTILLAS[id].grupo, "interno");
  });

  it("escapa lo que escriben las personas, en el HTML y en el asunto sin dejarlo ejecutable", () => {
    const hostil = `<img src=x onerror=alert(1)> "comillas" & 'simples'`;
    const mail = armarMail(
      "M12",
      { nombre: hostil, motivo: `<script>alert(1)</script>\n${hostil}` },
      { origen: ORIGEN },
    );
    assert.ok(!mail.html.includes("<script>"));
    assert.ok(!mail.html.includes("<img src=x"));
    assert.ok(mail.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert.ok(mail.html.includes("&quot;comillas&quot; &amp; &#39;simples&#39;"));

    const m60 = armarMail("M60", { nombre: hostil, email: "a@b.com", rol: null, mensaje: hostil }, { origen: ORIGEN });
    assert.ok(!m60.html.includes("<img src=x"));
    // El asunto es texto plano: el cliente de correo no lo interpreta como HTML, así que va sin escapar.
    assert.ok(m60.asunto.includes("<img src=x"));
  });

  it("M35 le cuenta a la institución si el profesional va a la entrevista o no puede ir, con su mensaje", () => {
    const base = { profesional: "Lucía Pérez", puesto: "Profesor de natación", cuando: "jueves, 8 de octubre, 10:30 hs", ruta: "/institucion/postulantes?busqueda=1" };

    const voy = armarMail("M35", { ...base, respuesta: "voy", mensaje: null }, { origen: ORIGEN, rutaDeBaja: "/avisos/baja?u=1&t=2" });
    assert.equal(voy.asunto, "Lucía Pérez confirmó la entrevista para Profesor de natación");
    assert.match(voy.texto, /confirmó que va a la entrevista/);
    assert.match(voy.texto, /jueves, 8 de octubre, 10:30 hs/);
    assert.doesNotMatch(voy.texto, /Su mensaje/);
    assert.doesNotMatch(voy.texto, /reprogramarla/);
    assert.ok(voy.html.includes("/institucion/postulantes?busqueda=1"), "el botón lleva al tablero de esa búsqueda");
    assert.ok(voy.urlDeBaja, "es un aviso de contratación: se puede apagar");

    const no = armarMail(
      "M35",
      { ...base, respuesta: "no_puedo", mensaje: "El jueves trabajo. ¿Podemos el viernes?" },
      { origen: ORIGEN },
    );
    assert.equal(no.asunto, "Lucía Pérez no puede ir a la entrevista para Profesor de natación");
    assert.match(no.texto, /no puede ir a la entrevista/);
    assert.match(no.texto, /Su mensaje:/);
    assert.match(no.texto, /> El jueves trabajo\. ¿Podemos el viernes\?/);
    assert.match(no.texto, /Reprogramar la entrevista/);
    assert.match(no.texto, /otro día desde el tablero/);

    // Lo que escribe la persona se escapa.
    const hostil = armarMail("M35", { ...base, respuesta: "no_puedo", mensaje: "<script>alert(1)</script>" }, { origen: ORIGEN });
    assert.ok(!hostil.html.includes("<script>"));
    assert.ok(hostil.html.includes("&lt;script&gt;"));
  });

  it("M67 avisa al equipo que una institución eligió pagar por semestre, distinguiendo la cuenta nueva del pedido posterior", () => {
    const datos = { institucion: "Colegio San Martín", total: "$ 250.000", meses: 6, ruta: "/backoffice/cobros/abc" };
    const alCrear = armarMail("M67", { ...datos, alCrearLaCuenta: true }, { origen: ORIGEN });
    assert.equal(alCrear.asunto, "Colegio San Martín eligió pagar por semestre");
    assert.match(alCrear.texto, /al crear su cuenta/);
    assert.match(alCrear.texto, /\$ 250\.000 por 6 meses/);
    assert.match(alCrear.texto, /Cuando verifiques la cuenta, coordiná/);
    assert.match(alCrear.texto, /Registrar semestre al contado/);
    assert.ok(alCrear.html.includes("/backoffice/cobros/abc"), "el botón lleva a la ficha de cobros");

    const despues = armarMail("M67", { ...datos, alCrearLaCuenta: false }, { origen: ORIGEN });
    assert.doesNotMatch(despues.texto, /al crear su cuenta/);
    assert.doesNotMatch(despues.texto, /Cuando verifiques/);
    assert.match(despues.texto, /pidió pagar el abono por semestre/);
    assert.match(despues.texto, /Coordiná el pago/);
  });

  it("M67 no deja ejecutar lo que escriben las instituciones en su nombre", () => {
    const mail = armarMail(
      "M67",
      { institucion: "<script>alert(1)</script>", total: "$ 1", meses: 6, alCrearLaCuenta: false, ruta: "/backoffice/cobros/abc" },
      { origen: ORIGEN },
    );
    assert.ok(!mail.html.includes("<script>"));
    assert.ok(mail.html.includes("&lt;script&gt;"));
  });

  it("M52 avisa hasta cuándo hay tiempo antes de que la cuenta se limite", () => {
    const m = armarMail("M52", EJEMPLOS.M52, { origen: ORIGEN });
    assert.match(m.texto, /Tenés tiempo hasta el 25 oct 2026/);
    assert.match(m.texto, /no vas a poder publicar búsquedas, invitar a postularse ni publicar cursos/);
  });

  it("M68 avisa del último plazo y, cuando pasó, de que la cuenta quedó limitada; no se puede apagar", () => {
    const previo = armarMail("M68", EJEMPLOS.M68, { origen: ORIGEN });
    assert.equal(previo.asunto, "Tu cuenta se limita después del 25 oct 2026");
    assert.match(previo.texto, /Si el pago no se acredita hasta el 25 oct 2026, tu cuenta queda limitada/);
    assert.match(previo.texto, /publicar búsquedas, invitar a postularse ni publicar cursos/);
    const limitada = armarMail("M68", { ...EJEMPLOS.M68, limitada: true }, { origen: ORIGEN });
    assert.equal(limitada.asunto, "Tu cuenta está limitada por una factura vencida");
    assert.match(limitada.texto, /pasaron más de 15 días/);
    assert.match(limitada.texto, /se levanta sola/);
    assert.ok(limitada.html.includes("/institucion/plan"), "lleva a Plan y facturación");
    assert.equal(PLANTILLAS.M68.grupo, "facturacion");
    assert.equal(esGrupoOpcional(PLANTILLAS.M68.grupo), false);
  });

  it("el asunto queda en una sola línea y con un largo razonable", () => {
    assert.equal(limpiarAsunto("Hola\r\nBcc: otro@example.com"), "Hola Bcc: otro@example.com");
    assert.equal(limpiarAsunto("  a \t b  "), "a b");
    const largo = limpiarAsunto("x".repeat(400));
    assert.ok(largo.length <= 150 && largo.endsWith("…"));
    const mail = armarMail("M60", { nombre: "Ana\r\nBcc: robo@example.com", email: "a@b.com", rol: null, mensaje: "hola" }, { origen: ORIGEN });
    assert.ok(!/[\r\n]/.test(mail.asunto));
  });

  it("los enlaces solo van al propio sitio", () => {
    assert.equal(urlInterna(ORIGEN, "/docente/perfil#documentacion"), `${ORIGEN}/docente/perfil#documentacion`);
    assert.equal(urlInterna(`${ORIGEN}/`, "/institucion/plan"), `${ORIGEN}/institucion/plan`);
    for (const mala of ["https://evil.example/x", "//evil.example/x", "javascript:alert(1)", "docente/perfil", "/\\evil.example", "/a\nb", ""]) {
      assert.throws(() => urlInterna(ORIGEN, mala), /Ruta no permitida/, mala);
    }
    assert.throws(
      () => armarMail("M20", { institucion: "X", puesto: "Y", ruta: "https://evil.example/" }, { origen: ORIGEN }),
      /Ruta no permitida/,
    );
  });

  it("los números de la plantilla salen en el asunto y el pie dice por qué llega el mail", () => {
    const m52 = armarMail("M52", { ...EJEMPLOS.M52, segundoAviso: true }, { origen: ORIGEN });
    assert.equal(m52.asunto, "Tu factura de octubre de 2026 sigue vencida");
    assert.equal(armarMail("M52", EJEMPLOS.M52, { origen: ORIGEN }).asunto, "Tu factura de octubre de 2026 está vencida");
    assert.equal(armarMail("M24", EJEMPLOS.M24, { origen: ORIGEN }).asunto, "Entrevista con Club Atlético: jueves, 8 de octubre, 10:30 hs");
    assert.equal(armarMail("M21", { ...EJEMPLOS.M21, plazo: null }, { origen: ORIGEN }).asunto, "Suplencia urgente cerca tuyo: Suplencia de matemática");
    assert.ok(armarMail("M21", EJEMPLOS.M21, { origen: ORIGEN }).asunto.endsWith("(hasta jueves 8 de octubre)"));
    assert.ok(armarMail("M06", EJEMPLOS.M06, { origen: ORIGEN }).texto.includes("Colegio San Martín te invitó a su equipo"));
    const invitacion = armarMail("M06", EJEMPLOS.M06, { origen: ORIGEN }).texto;
    // El enlace lleva directo a la invitación (no al registro genérico) y el texto ya no pide elegir el tipo de cuenta.
    assert.ok(invitacion.includes(`${ORIGEN}/invitacion/3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c`));
    assert.ok(!invitacion.includes("Soy institución"));
    assert.ok(armarMail("M50", EJEMPLOS.M50, { origen: ORIGEN }).texto.includes("no se pueden desactivar"));
  });

  it("M56 cambia de texto si no se aprobó, y la cita respeta los saltos de línea", () => {
    const no = armarMail("M56", { institucion: "X", plan: "Pro", aprobado: false, nota: "Falta el pago anterior.", detalle: null }, { origen: ORIGEN });
    assert.equal(no.asunto, "No pudimos aprobar tu cambio de plan");
    assert.ok(no.texto.includes("> Falta el pago anterior."));
    const si = armarMail("M56", { institucion: "X", plan: "Pro", aprobado: true, nota: null, detalle: "Cargamos tu factura de octubre 2026." }, { origen: ORIGEN });
    assert.equal(si.asunto, "Aprobamos tu cambio al plan Pro");
    assert.ok(si.texto.includes("Cargamos tu factura de octubre 2026."));
    const m12 = armarMail("M12", EJEMPLOS.M12, { origen: ORIGEN });
    assert.ok(m12.texto.includes("> El DNI se ve borroso.\n> Subilo de nuevo."));
    assert.ok(m12.html.includes("white-space:pre-wrap"));
  });

  it("M53 con comprobante lleva sus datos y el enlace a la hoja; sin él (búsqueda puntual) es solo el aviso", () => {
    const comprobante = {
      numero: "3F2A9C1E",
      plan: "Plan Colegios",
      medio: "Débito automático",
      pagadoEl: "10 oct 2026",
      ruta: "/institucion/plan/facturas/3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c",
    };
    const con = armarMail("M53", { ...EJEMPLOS.M53, comprobante }, { origen: ORIGEN });
    assert.equal(con.asunto, "Comprobante de tu pago de octubre de 2026");
    for (const dato of ["N.º: 3F2A9C1E", "Plan: Plan Colegios", "Período: Octubre de 2026", "Monto: $ 45.000", "Medio de pago: Débito automático", "Pagado el: 10 oct 2026"]) {
      assert.ok(con.texto.includes(dato), dato);
    }
    assert.ok(con.texto.includes(`Ver el comprobante: ${ORIGEN}/institucion/plan/facturas/3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c`));
    assert.ok(con.html.includes("Comprobante de pago") && con.html.includes("3F2A9C1E") && con.html.includes("Débito automático"));
    // Sin medio de pago cargado no queda una fila vacía.
    const sinMedio = armarMail("M53", { ...EJEMPLOS.M53, comprobante: { ...comprobante, medio: null } }, { origen: ORIGEN });
    assert.ok(!sinMedio.texto.includes("Medio de pago"));
    // El pago de una búsqueda puntual no es una factura: no hay comprobante, solo el aviso de siempre.
    const sin = armarMail("M53", { ...EJEMPLOS.M53, periodo: "una búsqueda puntual" }, { origen: ORIGEN });
    assert.equal(sin.asunto, "Recibimos tu pago de una búsqueda puntual");
    assert.ok(!sin.texto.includes("N.º:") && !sin.html.includes("Comprobante de pago"));
  });

  it("el comprobante escapa lo que viene de afuera (el nombre de la institución en la tabla)", () => {
    const mail = armarMail(
      "M53",
      {
        institucion: "<script>alert(1)</script>",
        periodo: "Octubre de 2026",
        monto: "$ 45.000",
        comprobante: { numero: "3F2A9C1E", plan: "Plan Colegios", medio: "Efectivo", pagadoEl: "10 oct 2026", ruta: "/institucion/plan/facturas/x" },
      },
      { origen: ORIGEN },
    );
    assert.ok(!mail.html.includes("<script>alert(1)</script>"));
    assert.ok(mail.html.includes("&lt;script&gt;"));
  });

  it("M15 se arma para un profesional y para una institución, con y sin motivo", () => {
    const docente = armarMail("M15", { nombre: "Lucía", institucion: null, motivo: "Datos falsos" }, { origen: ORIGEN });
    assert.ok(docente.texto.includes("Hola Lucía: suspendimos tu cuenta en UNIDOAR."));
    assert.ok(docente.texto.includes("> Datos falsos"));
    const institucion = armarMail("M15", { nombre: null, institucion: "Club Atlético", motivo: null }, { origen: ORIGEN });
    assert.ok(institucion.texto.includes("Hola: suspendimos la cuenta de Club Atlético en UNIDOAR."));
    assert.ok(!institucion.texto.includes("El motivo:") && !institucion.texto.includes("> "));
    const sinNombre = armarMail("M15", { nombre: null, institucion: null, motivo: null }, { origen: ORIGEN });
    assert.ok(sinNombre.texto.includes("Hola: suspendimos tu cuenta"));
  });

  it("M15 cuenta que se canceló el débito automático solo si se canceló, y solo a una institución", () => {
    const con = armarMail("M15", { nombre: null, institucion: "Club Atlético", motivo: "Datos falsos", debitoCancelado: true }, { origen: ORIGEN });
    assert.ok(con.texto.includes("También cancelamos el débito automático de tu plan"));
    const sin = armarMail("M15", { nombre: null, institucion: "Club Atlético", motivo: "Datos falsos" }, { origen: ORIGEN });
    assert.ok(!sin.texto.includes("débito automático"));
    const docente = armarMail("M15", { nombre: "Lucía", institucion: null, motivo: null, debitoCancelado: true }, { origen: ORIGEN });
    assert.ok(!docente.texto.includes("débito automático"));
  });

  it("M16 recuerda que el débito automático sigue cancelado solo si lo está, y solo a una institución", () => {
    const con = armarMail("M16", { nombre: null, institucion: "Club Atlético", debitoCancelado: true }, { origen: ORIGEN });
    assert.ok(con.texto.includes("Tu débito automático sigue cancelado"));
    const sin = armarMail("M16", { nombre: null, institucion: "Club Atlético" }, { origen: ORIGEN });
    assert.ok(!sin.texto.includes("débito automático"));
    const docente = armarMail("M16", { nombre: "Lucía", institucion: null, debitoCancelado: true }, { origen: ORIGEN });
    assert.ok(!docente.texto.includes("débito automático"));
  });

  it("M16 avisa la reactivación a un profesional y a una institución, cada uno con su botón", () => {
    const docente = armarMail("M16", { nombre: "Lucía", institucion: null }, { origen: ORIGEN });
    assert.ok(docente.texto.includes("Hola Lucía: reactivamos tu cuenta en UNIDOAR."));
    assert.ok(docente.texto.includes(`${ORIGEN}/docente/dashboard`));
    const institucion = armarMail("M16", { nombre: null, institucion: "Club Atlético" }, { origen: ORIGEN });
    assert.ok(institucion.texto.includes("Hola: reactivamos la cuenta de Club Atlético en UNIDOAR."));
    assert.ok(institucion.texto.includes(`${ORIGEN}/institucion/dashboard`));
    const sinNombre = armarMail("M16", { nombre: null, institucion: null }, { origen: ORIGEN });
    assert.ok(sinNombre.texto.includes("Hola: reactivamos tu cuenta"));
  });

  it("M58 avisa del cobro rechazado, lleva a Plan y facturación y no se puede apagar", () => {
    const m = armarMail("M58", EJEMPLOS.M58, { origen: ORIGEN });
    assert.ok(m.asunto.includes("débito automático de octubre de 2026"));
    assert.ok(m.texto.includes("Mercado Pago no pudo cobrar el plan de Club Atlético de Octubre de 2026 ($ 45.000)"));
    assert.ok(m.texto.includes(`${ORIGEN}/institucion/plan`));
    assert.equal(PLANTILLAS.M58.grupo, "facturacion");
    assert.equal(esGrupoOpcional(PLANTILLAS.M58.grupo), false);
  });

  it("M60 responde a quien escribió y el resto no define una respuesta propia", () => {
    assert.equal(PLANTILLAS.M60.responderA?.(EJEMPLOS.M60), "marta@example.com");
    assert.equal((PLANTILLAS.M06 as { responderA?: unknown }).responderA, undefined);
  });

  it("reconoce los ids de plantilla", () => {
    assert.ok(esPlantilla("M24"));
    assert.ok(!esPlantilla("M99"));
    assert.ok(!esPlantilla("constructor"));
    assert.ok(!esPlantilla("__proto__"));
    assert.equal(escaparHtml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("en la suspensión, 'El motivo:' encabeza la cita con el motivo (no el texto de las consecuencias)", () => {
    const m = armarMail("M15", { nombre: "Lucía", institucion: null, motivo: "Datos falsos" }, { origen: ORIGEN });
    const aviso = m.texto.indexOf("Mientras esté suspendida");
    const encabezado = m.texto.indexOf("El motivo:");
    const cita = m.texto.indexOf("> Datos falsos");
    assert.ok(aviso >= 0 && encabezado > aviso && cita > encabezado, "orden: consecuencias, 'El motivo:', cita");
    assert.ok(!m.texto.slice(encabezado, cita).includes("Mientras"), "entre el encabezado y la cita no hay otro texto");
  });

  it("el pedido de baja nombra 'profesional' e 'institución', no el valor interno", () => {
    const profesional = armarMail("M62", { cuenta: "Lucía Pérez", tipo: "docente", ruta: "/backoffice/docentes" }, { origen: ORIGEN });
    assert.ok(profesional.texto.includes("(profesional)") && !profesional.texto.includes("(docente)"));
    const institucion = armarMail("M62", { cuenta: "Colegio Norte", tipo: "institucion", ruta: "/backoffice/instituciones" }, { origen: ORIGEN });
    assert.ok(institucion.texto.includes("(institución)") && !institucion.texto.includes("(institucion)"));
  });

describe("M24 · responder la entrevista desde el mail", () => {
  it("trae Voy, No puedo y Ver en la plataforma, que solo llevan a la postulación", () => {
    const mail = armarMail("M24", EJEMPLOS.M24, { origen: ORIGEN });
    assert.ok(mail.html.includes(`${ORIGEN}/docente/postulaciones?abrir=1&amp;entrevista=voy`));
    assert.ok(mail.html.includes(`${ORIGEN}/docente/postulaciones?abrir=1&amp;entrevista=no-puedo`));
    assert.ok(mail.html.includes("Ver en la plataforma"));
    assert.ok(mail.texto.includes(`No puedo ir: ${ORIGEN}/docente/postulaciones?abrir=1&entrevista=no-puedo`));
  });
});
});
