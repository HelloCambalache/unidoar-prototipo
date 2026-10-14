import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esRutaDeRecuperacion, RUTA_NUEVA_CONTRASENA } from "@/lib/recuperacion";

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
