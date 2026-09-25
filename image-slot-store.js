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

  // Lectura para la propia app: pantallas donde la foto se muestra pero no se
  // edita (un docente ve el curso que cargó la institución) usan un <img>
  // común en vez de un <image-slot>, y necesitan la URL guardada.
  // La caché se invalida comparando el texto crudo, no con una bandera: el
  // runtime ejecuta este script dos veces y cada copia tendría su propia
  // bandera, así que una escritura no limpiaba la caché de la otra.
  var cacheRaw = null;
  var cacheObj = {};
  function leerTodo() {
    var raw = '';
    try { raw = localStorage.getItem(CLAVE) || ''; } catch (e) {}
    if (raw === cacheRaw) return cacheObj;
    cacheRaw = raw;
    try { cacheObj = raw ? JSON.parse(raw) : {}; } catch (e) { cacheObj = {}; }
    return cacheObj;
  }
  window.udImageSlots = {
    get: function (id) {
      if (!id) return null;
      var v = leerTodo()[id];
      if (!v) return null;
      var url = typeof v === 'string' ? v : v.u;
      return typeof url === 'string' && url.indexOf('data:image/') === 0 ? url : null;
    },
  };

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
