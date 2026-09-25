/* Persistencia de <image-slot> para el prototipo estático.
 *
 * image-slot.js guarda las fotos en un sidecar `.image-slots.state.json`:
 * lo lee con fetch() y lo escribe con window.omelette.writeFile, que sólo
 * existe dentro del runtime de Claude Design. En el deploy de Vercel no hay
 * runtime, así que los slots quedaban en sólo lectura y no se podía subir
 * ninguna foto.
 *
 * Este puente reemplaza las dos puntas por localStorage. Tiene que cargarse
 * ANTES que image-slot.js, porque el componente decide si es editable mirando
 * window.omelette en el primer render.
 *
 * Alcance: las fotos quedan guardadas en el navegador de quien las sube, no en
 * el repo. Alcanza para mostrar el prototipo; cuando esto pase al MVP la carga
 * va contra el backend.
 */
(function () {
  var ARCHIVO = '.image-slots.state.json';
  var CLAVE = 'unidoar:image-slots';

  window.omelette = window.omelette || {};
  if (!window.omelette.writeFile) {
    window.omelette.writeFile = function (nombre, contenido) {
      if (String(nombre).indexOf(ARCHIVO) === -1) return Promise.resolve();
      try {
        localStorage.setItem(CLAVE, contenido);
      } catch (e) {
        // Cuota llena (las fotos van en base64). La foto sigue viéndose en
        // esta sesión, pero no sobrevive al reload.
        console.warn('[unidoar] no se pudo guardar la foto en localStorage:', e);
      }
      return Promise.resolve();
    };
  }

  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(ARCHIVO) !== -1) {
      var guardado = null;
      try {
        guardado = localStorage.getItem(CLAVE);
      } catch (e) {}
      return Promise.resolve(
        new Response(guardado || '{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return fetchOriginal(input, init);
  };
})();
