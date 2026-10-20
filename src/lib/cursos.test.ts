import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cursoSchema, esEnlaceWeb, valoresDeCurso } from "./cursos";

const base = { titulo: "Primeros auxilios", modalidad: "Online", certifica: "on" };

describe("contraseña de la sala de un curso online", () => {
  it("se guarda junto al link (por ejemplo, la de Zoom)", () => {
    const r = cursoSchema.safeParse({ ...base, link: "https://zoom.us/j/123456789", linkClave: "  482915  " });
    assert.equal(r.success, true);
    const v = valoresDeCurso(r.data!);
    assert.equal(v.link, "https://zoom.us/j/123456789");
    assert.equal(v.linkClave, "482915");
  });

  it("es opcional: sin contraseña queda en null", () => {
    const r = cursoSchema.safeParse({ ...base, link: "https://meet.google.com/abc-defg-hij", linkClave: "" });
    assert.equal(r.success, true);
    assert.equal(valoresDeCurso(r.data!).linkClave, null);
  });

  it("sin link no se guarda una contraseña suelta", () => {
    const r = cursoSchema.safeParse({ ...base, link: "", linkClave: "482915" });
    assert.equal(r.success, true);
    assert.equal(valoresDeCurso(r.data!).linkClave, null);
  });

  it("en un curso presencial no se guarda ni link ni contraseña", () => {
    const r = cursoSchema.safeParse({ ...base, modalidad: "Presencial", link: "https://zoom.us/j/1", linkClave: "1234" });
    assert.equal(r.success, true);
    const v = valoresDeCurso(r.data!);
    assert.equal(v.link, null);
    assert.equal(v.linkClave, null);
  });

  it("tiene un tope de largo", () => {
    const r = cursoSchema.safeParse({ ...base, link: "https://zoom.us/j/1", linkClave: "x".repeat(101) });
    assert.equal(r.success, false);
  });
});

describe("enlaces que se muestran", () => {
  it("solo http y https llegan a un enlace", () => {
    assert.equal(esEnlaceWeb("https://meet.google.com/abc-defg-hij"), true);
    assert.equal(esEnlaceWeb("http://sala.ejemplo.com/x"), true);
    assert.equal(esEnlaceWeb(" HTTPS://sala.ejemplo.com "), true);
  });

  it("lo demás se muestra como texto, nunca como link", () => {
    for (const malo of ["javascript:alert(1)", "data:text/html,<script>1</script>", "mailto:a@b.c", "ftp://x.y", "//otro.com", "meet.google.com/abc", "", "   "]) {
      assert.equal(esEnlaceWeb(malo), false, malo);
    }
    assert.equal(esEnlaceWeb(null), false);
    assert.equal(esEnlaceWeb(undefined), false);
  });
});
