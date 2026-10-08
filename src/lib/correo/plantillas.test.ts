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
  M20: { institucion: "Club Atlético", puesto: "Profesor de natación", ruta: "/docente/buscar-trabajo" },
  M21: { institucion: "Club Atlético", puesto: "Suplencia de matemática", zona: "Quilmes", plazo: "jueves 8 de octubre", ruta: "/docente/buscar-trabajo" },
  M23: { institucion: "Club Atlético", puesto: "Profesor", ruta: "/docente/postulaciones?abrir=1" },
  M24: { institucion: "Club Atlético", puesto: "Profesor", cuando: "jueves, 8 de octubre, 10:30 hs", titulo: "Entrevista con dirección", ruta: "/docente/postulaciones?abrir=1" },
  M25: { institucion: "Club Atlético", puesto: "Profesor", ruta: "/docente/postulaciones?abrir=1" },
  M26: { institucion: "Club Atlético", puesto: "Profesor", ruta: "/docente/postulaciones?abrir=1" },
  M27: { institucion: "Club Atlético", puesto: "Profesor", inicio: "01/03/2027", ruta: "/docente/postulaciones?abrir=1" },
  M30: { busqueda: "Profesor de natación", rapida: false, ruta: "/institucion/postulantes?busqueda=1" },
  M50: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000", vence: "10 oct 2026" },
  M51: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000", vence: "10 oct 2026" },
  M52: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000", vencio: "10 oct 2026", segundoAviso: false },
  M53: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000" },
  M54: { institucion: "Club Atlético", periodo: "Octubre de 2026", monto: "$ 45.000" },
  M55: { institucion: "Club Atlético", plan: "Pro" },
  M56: { institucion: "Club Atlético", plan: "Pro", aprobado: true, nota: null, detalle: null },
  M60: { nombre: "Marta", email: "marta@example.com", rol: "Institución", mensaje: "Hola, quiero consultar un precio." },
  M61: { docente: "Lucía Pérez", detalle: "subió documentación para revisar.", ruta: "/backoffice/verificacion" },
  M62: { cuenta: "Lucía Pérez", tipo: "docente", ruta: "/backoffice/docentes" },
  M63: { institucion: "Club Atlético", plan: "Pro", ruta: "/backoffice/cobros" },
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
    assert.deepEqual(opcionales, ["M20", "M21", "M23", "M24", "M25", "M26", "M27", "M30"]);
    for (const id of ["M11", "M12", "M13", "M15", "M06"] as const) assert.equal(PLANTILLAS[id].grupo, "cuenta");
    for (const id of ["M50", "M51", "M52", "M53", "M54", "M55", "M56"] as const) {
      assert.equal(PLANTILLAS[id].grupo, "facturacion");
      assert.equal(PLANTILLAS[id].remitente, "facturacion");
    }
    for (const id of ["M60", "M61", "M62", "M63"] as const) assert.equal(PLANTILLAS[id].grupo, "interno");
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
});
