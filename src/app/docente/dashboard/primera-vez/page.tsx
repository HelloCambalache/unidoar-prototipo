import { redirect } from "next/navigation";

/** La variante "recién registrado" se muestra sola en /docente/dashboard cuando no hay postulaciones. */
export default function PrimeraVezPage() {
  redirect("/docente/dashboard");
}
