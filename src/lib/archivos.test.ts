import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { objetoDeArchivo, patronDePaths, quitados } from "@/lib/archivos";
import { CARPETA_DE_PASO, urlPublicaDe } from "@/lib/subidas";

const UID = "1b8c3355-2755-443f-af6a-0a2a7a06b997";
const ARCHIVO = "3f2a9c1e-77aa-4d3b-9c0e-123456789abc";

describe("qué archivo de Storage referencia un valor guardado", () => {
  before(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
  });

  it("una URL pública del bucket público apunta a su path", () => {
    const path = `${UID}/logos/${ARCHIVO}.webp`;
    assert.deepEqual(objetoDeArchivo(urlPublicaDe(path)), { bucket: "publico", path });
  });

  it("un path suelto es del bucket privado", () => {
    const path = `${UID}/documentos/${ARCHIVO}.pdf`;
    assert.deepEqual(objetoDeArchivo(path), { bucket: "privado", path });
    assert.deepEqual(objetoDeArchivo(`${UID}/cv/${ARCHIVO}.pdf`), { bucket: "privado", path: `${UID}/cv/${ARCHIVO}.pdf` });
  });

  it("no toca lo que no subió la app: logos estáticos, URLs ajenas, texto cualquiera o vacío", () => {
    for (const valor of ["/assets/logo.svg", "https://lh3.googleusercontent.com/a/foto", "hola", "", null, undefined]) {
      assert.equal(objetoDeArchivo(valor), null, String(valor));
    }
  });

  it("no reconoce carpetas que la app no permite, ni la de paso de los PDF grandes", () => {
    assert.equal(objetoDeArchivo(`${UID}/otra/${ARCHIVO}.pdf`), null);
    assert.equal(objetoDeArchivo(`${UID}/${CARPETA_DE_PASO}/${ARCHIVO}.pdf`), null);
  });

  it("no acepta un path con otra forma (salirse de la carpeta o falta el usuario)", () => {
    assert.equal(objetoDeArchivo(`${UID}/documentos/../x.pdf`), null);
    assert.equal(objetoDeArchivo(`documentos/${ARCHIVO}.pdf`), null);
    assert.equal(objetoDeArchivo(`${UID}/documentos/a/b.pdf`), null);
  });
});

describe("archivos que dejaron de usarse", () => {
  it("devuelve lo que estaba antes y ya no está, sin repetidos ni vacíos", () => {
    assert.deepEqual(quitados(["a", "b", "c", "b", null, undefined, ""], ["a", "d", null]), ["b", "c"]);
  });

  it("si no cambió nada no quita nada", () => {
    assert.deepEqual(quitados(["a", "b"], ["b", "a"]), []);
    assert.deepEqual(quitados([], ["a"]), []);
    assert.deepEqual(quitados(["a"], []), ["a"]);
  });
});

describe("patrón para encontrar paths dentro de un texto", () => {
  it("encuentra los paths de la app con sus carpetas permitidas", () => {
    const patron = new RegExp(patronDePaths(), "g");
    const texto = `{"dniFrente":"${UID}/documentos/${ARCHIVO}.jpg","cv":"${UID}/cv/${ARCHIVO}.pdf","x":"${UID}/otra/${ARCHIVO}.pdf"}`;
    assert.deepEqual(texto.match(patron), [`${UID}/documentos/${ARCHIVO}.jpg`, `${UID}/cv/${ARCHIVO}.pdf`]);
  });
});
