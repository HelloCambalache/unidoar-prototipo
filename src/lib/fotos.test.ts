import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { FOCO_POR_DEFECTO, FOCOS, focoDeFoto } from "./fotos";

const FORMATO = /^(\d{1,3})% (\d{1,3})%$/;

describe("encuadre de las fotos", () => {
  it("cada punto tiene el formato «x% y%» y cae dentro de la foto", () => {
    for (const [ruta, foco] of Object.entries({ ...FOCOS, defecto: FOCO_POR_DEFECTO })) {
      const m = FORMATO.exec(foco);
      assert.ok(m, `${ruta}: «${foco}» no tiene el formato «x% y%»`);
      assert.ok(Number(m[1]) <= 100 && Number(m[2]) <= 100, `${ruta}: «${foco}» se sale de la foto`);
    }
  });

  it("cada foto registrada existe en public/ (una renombrada o borrada no queda colgada)", () => {
    for (const ruta of Object.keys(FOCOS)) {
      assert.ok(existsSync(join(process.cwd(), "public", ruta)), `${ruta} no existe en public/`);
    }
  });

  it("devuelve el punto de la foto, también con query u origen delante", () => {
    assert.equal(focoDeFoto("/assets/onboarding-bg-1.jpg"), "29% 24%");
    assert.equal(focoDeFoto("/assets/onboarding-bg-1.jpg?v=2"), "29% 24%");
    assert.equal(focoDeFoto("https://www.unidoar.com.ar/assets/onboarding-bg-1.jpg"), "29% 24%");
  });

  it("una foto que no conoce (subida por una persona) o vacía usa el punto por defecto", () => {
    assert.equal(focoDeFoto("https://x.supabase.co/storage/v1/object/public/publico/u/fotos/a.jpg"), FOCO_POR_DEFECTO);
    assert.equal(focoDeFoto(null), FOCO_POR_DEFECTO);
    assert.equal(focoDeFoto(undefined), FOCO_POR_DEFECTO);
    assert.equal(focoDeFoto(""), FOCO_POR_DEFECTO);
  });

  it("el punto por defecto queda un poco más arriba del centro, donde suele estar la cara", () => {
    const [, , y] = /^(\d+)% (\d+)%$/.exec(FOCO_POR_DEFECTO) ?? [];
    assert.ok(Number(y) < 50);
  });
});
