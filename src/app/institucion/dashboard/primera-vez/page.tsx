import { redirect } from "next/navigation";

/** La variante "primera vez" se muestra sola en /institucion/dashboard cuando todavía no hay búsquedas. */
export default function PrimeraVez() {
  redirect("/institucion/dashboard");
}
