/*
 * "Elegir una contraseña nueva" sin la actual solo vale para quien llegó por el enlace del mail de recuperación. Ese enlace deja una
 * cookie de corta vida (httpOnly, así que un script o quien solo tenga la sesión no puede fabricarla) y la pantalla y la acción la
 * exigen. Sin esto, cualquiera con una sesión abierta de otra persona (una computadora compartida) podía fijar una contraseña nueva
 * entrando directo a /ingresar/nueva-contrasena, y esa contraseña después pasa el pedido de "contraseña actual" de Mi cuenta.
 * Sin base ni Next: lo usan las rutas, la página, la acción y las pruebas.
 */

export const COOKIE_RECUPERACION = "unidoar_recuperacion";
/** Cuánto dura el permiso: lo justo para elegir la contraseña nueva. */
export const VIDA_RECUPERACION_SEGUNDOS = 15 * 60;

export const RUTA_NUEVA_CONTRASENA = "/ingresar/nueva-contrasena";

/** ¿Este destino es la pantalla de elegir la contraseña nueva? (el enlace viejo de Supabase la pide por `next`) */
export const esRutaDeRecuperacion = (ruta: string) => ruta === RUTA_NUEVA_CONTRASENA || ruta.startsWith(`${RUTA_NUEVA_CONTRASENA}?`);
