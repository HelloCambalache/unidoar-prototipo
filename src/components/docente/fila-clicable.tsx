"use client";

import { useRouter } from "next/navigation";

/**
 * Fila de tabla que abre su detalle al hacer clic en cualquier parte. El acceso por teclado y de
 * lectores de pantalla lo da el link real que va dentro de una de sus celdas.
 */
export function FilaClicable({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="cursor-pointer"
      onClick={(e) => {
        // Los links y botones de adentro ya navegan solos.
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href, { scroll: false });
      }}
    >
      {children}
    </tr>
  );
}
