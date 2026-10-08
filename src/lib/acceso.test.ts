import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ERRORES_DE_INGRESO, esFallaDeEnvioDeMail, googleActivadoEn, registrarFallaDeMail, rutaInternaSegura, traducirErrorAuth } from "@/lib/acceso";

describe("destino interno después de ingresar (?next=)", () => {
  it("conserva una ruta interna con su consulta y su ancla", () => {
    assert.equal(rutaInternaSegura("/docente/perfil?x=1#a"), "/docente/perfil?x=1#a");
    assert.equal(rutaInternaSegura("/institucion/postulantes?busqueda=abc"), "/institucion/postulantes?busqueda=abc");
    assert.equal(rutaInternaSegura("/"), "/");
  });

  it("usa el destino por defecto cuando falta o no es una ruta", () => {
    for (const valor of [undefined, null, "", "inicio", "docente/perfil"]) {
      assert.equal(rutaInternaSegura(valor), "/inicio", String(valor));
    }
    assert.equal(rutaInternaSegura(null, "/registro"), "/registro");
  });

  it("nunca deja salir a otro dominio, ni siquiera con trucos de normalización", () => {
    const hostiles = [
      "//evil.com",
      "///evil.com",
      "https://evil.com",
      "http://evil.com/x",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "/\\evil.com",
      "/\tevil.com",
      "/..//evil.com",
      "/.//evil.com",
      "/a/..//evil.com",
      "/%2e%2e//evil.com",
      "/a/%2e%2e//evil.com",
      "/ok\n",
    ];
    for (const valor of hostiles) {
      const r = rutaInternaSegura(valor);
      assert.ok(!r.startsWith("//"), `${JSON.stringify(valor)} dio ${JSON.stringify(r)}`);
      assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(r), `${JSON.stringify(valor)} dio ${JSON.stringify(r)}`);
      assert.ok(r.startsWith("/"), `${JSON.stringify(valor)} dio ${JSON.stringify(r)}`);
    }
    assert.equal(rutaInternaSegura("/..//evil.com"), "/inicio");
    assert.equal(rutaInternaSegura("/%2e%2e//evil.com"), "/inicio");
  });

  it("deja pasar rutas raras pero internas (la barra codificada no sube de nivel)", () => {
    assert.equal(rutaInternaSegura("/%2F/evil.com"), "/%2F/evil.com");
    assert.equal(rutaInternaSegura("/?next=//evil.com"), "/?next=//evil.com");
  });
});

describe("ingreso con Google", () => {
  it("solo se ofrece si Supabase lo informa como activado", () => {
    assert.equal(googleActivadoEn({ external: { google: true, email: true } }), true);
    assert.equal(googleActivadoEn({ external: { google: false } }), false);
    assert.equal(googleActivadoEn({ external: { email: true } }), false);
  });

  it("cualquier otra respuesta cuenta como apagado", () => {
    for (const valor of [null, undefined, "google", 1, [], {}, { external: null }, { external: "x" }, { external: { google: "true" } }]) {
      assert.equal(googleActivadoEn(valor), false, JSON.stringify(valor));
    }
  });
});

describe("mensajes de error de Supabase Auth", () => {
  it("traduce por código", () => {
    assert.match(traducirErrorAuth({ code: "invalid_credentials" }), /email o la contraseña no son correctos/);
    assert.match(traducirErrorAuth({ code: "email_not_confirmed" }), /confirmaste tu email/);
    assert.match(traducirErrorAuth({ code: "over_email_send_rate_limit" }), /demasiados mails/);
    assert.match(traducirErrorAuth({ code: "otp_expired" }), /venció o ya se usó/);
    assert.match(traducirErrorAuth({ code: "user_already_exists" }), /Ya hay una cuenta/);
  });

  it("si no hay código, reconoce el texto en inglés", () => {
    assert.match(traducirErrorAuth({ message: "Invalid login credentials" }), /no son correctos/);
    assert.match(traducirErrorAuth({ message: "User already registered" }), /Ya hay una cuenta/);
    assert.match(traducirErrorAuth({ message: "Password should be at least 6 characters" }), /muy fácil de adivinar/);
  });

  it("si Supabase no pudo mandar el mail, lo dice claro (aunque el código sea el genérico unexpected_failure)", () => {
    for (const message of ["Error sending confirmation email", "Error sending recovery email", "Error sending email change email"]) {
      const msg = traducirErrorAuth({ message, code: "unexpected_failure" });
      assert.match(msg, /No pudimos mandarte el mail/);
      assert.ok(!/Error sending/.test(msg));
      assert.equal(esFallaDeEnvioDeMail({ message }), true, message);
    }
    // Un 500 cualquiera sigue siendo genérico: no se le atribuye al mail.
    assert.match(traducirErrorAuth({ message: "Database error saving new user", code: "unexpected_failure" }), /No pudimos completar la operación/);
    assert.equal(esFallaDeEnvioDeMail({ message: "Database error saving new user" }), false);
    assert.equal(esFallaDeEnvioDeMail(null), false);
    assert.equal(esFallaDeEnvioDeMail({}), false);
  });

  it("registrarFallaDeMail solo escribe en el log cuando es una falla de envío", () => {
    const original = console.error;
    const llamadas: unknown[][] = [];
    console.error = (...args: unknown[]) => void llamadas.push(args);
    try {
      registrarFallaDeMail({ message: "Error sending recovery email", code: "unexpected_failure" }, "recuperar");
      registrarFallaDeMail({ message: "Invalid login credentials", code: "invalid_credentials" }, "ingresar");
      registrarFallaDeMail(null, "nada");
    } finally {
      console.error = original;
    }
    assert.equal(llamadas.length, 1);
    assert.deepEqual((llamadas[0]![1] as { paso: string }).paso, "recuperar");
  });

  it("ante algo desconocido da un mensaje genérico y no muestra el texto crudo", () => {
    const msg = traducirErrorAuth({ message: "duplicate key value violates unique constraint foo_pkey", code: "xyz" });
    assert.match(msg, /No pudimos completar la operación/);
    assert.ok(!/duplicate key/.test(msg));
    assert.match(traducirErrorAuth(null), /No pudimos completar la operación/);
  });

  it("los avisos de /ingresar?error= existen para los dos motivos que deja /auth/callback", () => {
    assert.ok(ERRORES_DE_INGRESO.enlace);
    assert.ok(ERRORES_DE_INGRESO.oauth);
  });
});
