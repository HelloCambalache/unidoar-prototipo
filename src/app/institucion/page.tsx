import { redirect } from "next/navigation";

/** `/institucion` no tiene pantalla propia: el inicio de la institución es el dashboard. El layout ya exige la sesión del área. */
export default function InstitucionInicio() {
  redirect("/institucion/dashboard");
}
