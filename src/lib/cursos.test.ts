import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cursoSchema, esEnlaceWeb, lugarDeCurso, valoresDeCurso } from "./cursos";

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
    const r = cursoSchema.safeParse({
      ...base,
      modalidad: "Presencial",
      direccion: "Maipú 1234, Vicente López",
      link: "https://zoom.us/j/1",
      linkClave: "1234",
    });
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

describe("dónde se dicta un curso", () => {
  const presencial = { ...base, modalidad: "Presencial" };

  it("un curso presencial no se guarda sin dirección", () => {
    for (const direccion of [undefined, "", "   "]) {
      const r = cursoSchema.safeParse({ ...presencial, direccion });
      assert.equal(r.success, false);
      assert.equal(r.error!.issues[0].path[0], "direccion");
    }
  });

  it("uno online no necesita dirección", () => {
    assert.equal(cursoSchema.safeParse({ ...base, direccion: "" }).success, true);
  });

  it("con dirección se guarda, y en uno online se descarta", () => {
    const p = cursoSchema.safeParse({ ...presencial, direccion: "  Maipú 1234  " });
    assert.equal(p.success, true);
    assert.equal(valoresDeCurso(p.data!).direccion, "Maipú 1234");
    const o = cursoSchema.safeParse({ ...base, direccion: "Maipú 1234" });
    assert.equal(valoresDeCurso(o.data!).direccion, null);
  });

  it("lugarDeCurso: online dice Online, aunque tenga una dirección vieja", () => {
    assert.equal(lugarDeCurso({ modalidad: "Online", direccion: null }), "Online");
    assert.equal(lugarDeCurso({ modalidad: "Online", direccion: "Maipú 1234" }), "Online");
  });

  it("lugarDeCurso: presencial suma el partido y la provincia que se ubicaron", () => {
    assert.equal(
      lugarDeCurso({ modalidad: "Presencial", direccion: "Maipu 1234", partido: "La Capital", provincia: "Santa Fe" }),
      "Maipu 1234, La Capital, Santa Fe",
    );
  });

  it("lugarDeCurso: no repite lo que la dirección ya dice (con o sin tildes)", () => {
    assert.equal(
      lugarDeCurso({ modalidad: "Presencial", direccion: "Maipú 1234, Vicente Lopez", partido: "Vicente López", provincia: "Buenos Aires" }),
      "Maipú 1234, Vicente Lopez, Buenos Aires",
    );
  });

  it("lugarDeCurso: presencial sin dirección devuelve null para que la pantalla lo avise", () => {
    assert.equal(lugarDeCurso({ modalidad: "Presencial", direccion: null }), null);
    assert.equal(lugarDeCurso({ modalidad: "Presencial", direccion: "  ", partido: "La Capital" }), null);
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
