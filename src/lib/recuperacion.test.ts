import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esRutaDeRecuperacion,
  firmarRecuperacion,
  recuperacionVigente,
  RUTA_NUEVA_CONTRASENA,
  VIDA_RECUPERACION_SEGUNDOS,
} from "@/lib/recuperacion";

describe("qué destino es el de elegir la contraseña nueva", () => {
  it("la pantalla de la contraseña nueva, con o sin parámetros", () => {
    assert.equal(esRutaDeRecuperacion(RUTA_NUEVA_CONTRASENA), true);
    assert.equal(esRutaDeRecuperacion("/ingresar/nueva-contrasena?x=1"), true);
  });

  it("ningún otro destino deja el permiso", () => {
    assert.equal(esRutaDeRecuperacion("/inicio"), false);
    assert.equal(esRutaDeRecuperacion("/ingresar"), false);
    assert.equal(esRutaDeRecuperacion("/ingresar/nueva-contrasena-otra"), false);
    assert.equal(esRutaDeRecuperacion("/docente/cuenta?next=/ingresar/nueva-contrasena"), false);
  });
});

describe("permiso para elegir la contraseña nueva (cookie firmada)", () => {
  const ENTORNO = { CORREO_SECRETO: "un-secreto-largo-de-prueba-0123456789" };
  const OTRO_ENTORNO = { CORREO_SECRETO: "otro-secreto-largo-de-prueba-9876543210" };
  const ahora = 1_800_000_000_000;
  const ana = "1b8c3355-2755-443f-af6a-0a2a7a06b997";
  const beto = "00000000-0000-4000-8000-000000000000";

  it("el servidor lo emite para una cuenta y vale para esa cuenta", () => {
    const cookie = firmarRecuperacion(ana, ENTORNO, ahora)!;
    assert.ok(cookie);
    assert.equal(recuperacionVigente(cookie, ana, ENTORNO, ahora + 1000), true);
  });

  it("no vale para otra cuenta", () => {
    const cookie = firmarRecuperacion(ana, ENTORNO, ahora)!;
    assert.equal(recuperacionVigente(cookie, beto, ENTORNO, ahora + 1000), false);
  });

  it('un valor fabricado a mano ("1", sin firma o con una firma inventada) no vale', () => {
    for (const falso of ["1", "", "123", "1800000900000.firma-inventada", `${ahora + 60_000}.`, `.${"a".repeat(43)}`, "a.b.c"]) {
      assert.equal(recuperacionVigente(falso, ana, ENTORNO, ahora), false, falso);
    }
  });

  it("no se puede estirar el plazo cambiando la fecha: la firma deja de coincidir", () => {
    const cookie = firmarRecuperacion(ana, ENTORNO, ahora)!;
    const [vence, firma] = cookie.split(".") as [string, string];
    const estirada = `${Number(vence) + 3_600_000}.${firma}`;
    assert.equal(recuperacionVigente(estirada, ana, ENTORNO, ahora + 1000), false);
  });

  it("vence a los 15 minutos", () => {
    const cookie = firmarRecuperacion(ana, ENTORNO, ahora)!;
    assert.equal(recuperacionVigente(cookie, ana, ENTORNO, ahora + (VIDA_RECUPERACION_SEGUNDOS - 1) * 1000), true);
    assert.equal(recuperacionVigente(cookie, ana, ENTORNO, ahora + VIDA_RECUPERACION_SEGUNDOS * 1000), false);
    assert.equal(recuperacionVigente(cookie, ana, ENTORNO, ahora + 2 * 3_600_000), false);
  });

  it("una firma hecha con otro secreto no vale", () => {
    const ajena = firmarRecuperacion(ana, OTRO_ENTORNO, ahora)!;
    assert.equal(recuperacionVigente(ajena, ana, ENTORNO, ahora + 1000), false);
  });

  it("sin secreto en el servidor no se emite ni se acepta nada", () => {
    assert.equal(firmarRecuperacion(ana, {}, ahora), null);
    assert.equal(firmarRecuperacion(ana, { CORREO_SECRETO: "corto" }, ahora), null);
    const cookie = firmarRecuperacion(ana, ENTORNO, ahora)!;
    assert.equal(recuperacionVigente(cookie, ana, {}, ahora + 1000), false);
    assert.equal(recuperacionVigente(cookie, "", ENTORNO, ahora + 1000), false);
    assert.equal(recuperacionVigente(null, ana, ENTORNO, ahora), false);
  });

  it("sirve la clave de servicio como secreto si no hay uno propio (igual que las otras firmas)", () => {
    const entorno = { SUPABASE_SERVICE_ROLE_KEY: "clave-de-servicio-larga-de-prueba-123" };
    const cookie = firmarRecuperacion(ana, entorno, ahora)!;
    assert.equal(recuperacionVigente(cookie, ana, entorno, ahora + 1000), true);
  });
});
