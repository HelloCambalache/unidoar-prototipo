import { redirect } from "next/navigation";

/** `/backoffice` no tiene pantalla propia: el inicio del equipo es Operación. El layout ya exige el rol `admin`. */
export default function BackofficeInicio() {
  redirect("/backoffice/operacion");
}
