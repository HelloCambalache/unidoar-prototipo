import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-xl border border-borde bg-white px-3 py-2.5 text-sm text-tinta transition-[border-color,box-shadow] duration-150 placeholder:text-sutil focus:border-navy-700 focus:outline-none focus:ring-[3px] focus:ring-navy-700/20 disabled:cursor-not-allowed disabled:bg-black/5 disabled:opacity-50 aria-invalid:border-[#dc2626]";

// Sin espacios ni comillas en el data URI (%20, %27): un espacio parte la clase en dos, Tailwind no genera la regla
// y tailwind-merge descarta el `bg-white` del control.
const FLECHA =
  "bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2716%27%20height=%2716%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%236b7280%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpolyline%20points=%276%209%2012%2015%2018%209%27/%3E%3C/svg%3E)] bg-no-repeat bg-[position:right_12px_center]";

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido,
  className,
  children,
}: {
  etiqueta?: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {etiqueta && (
        <span className="text-xs font-semibold text-apagado">
          {etiqueta}
          {requerido && <span className="ml-0.5 text-[#dc2626]">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span role="alert" className="text-xs text-[#b91c1c]">
          {error}
        </span>
      ) : ayuda ? (
        <span className="text-xs text-sutil">{ayuda}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "cursor-pointer appearance-none pr-[34px]", FLECHA, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-[84px] resize-y leading-normal", className)} {...props} />;
}

export function Casilla({
  className,
  children,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 text-[13px] leading-snug text-tinta-2", className)}>
      <input type="checkbox" className="mt-0.5 size-4 flex-none accent-navy-700" {...props} />
      <span>{children}</span>
    </label>
  );
}
