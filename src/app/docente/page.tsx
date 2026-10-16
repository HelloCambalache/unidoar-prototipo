import { redirect } from "next/navigation";

/** `/docente` no tiene pantalla propia: el inicio del profesional es el dashboard. El layout ya exige la sesión del área. */
export default function DocenteInicio() {
  redirect("/docente/dashboard");
}
