/** Aviso que se muestra en "Mi cuenta" cuando la persona vuelve del enlace de confirmación del cambio de email. */
export function AvisoEmailConfirmado({ email }: { email: string }) {
  return (
    <p role="status" className="m-0 rounded-lg bg-verde-tint px-3.5 py-3 text-[13.5px] leading-snug text-verde">
      Listo: tu email de acceso ahora es <b className="font-semibold">{email}</b>. Desde ahora ingresás con ese.
    </p>
  );
}
