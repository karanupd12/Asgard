import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent/90",
  secondary: "bg-surface text-fg border border-border hover:border-fg/30",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "text-danger border border-danger/35 hover:bg-danger/10",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
  icon: "h-10 w-10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted",
      "transition-colors focus:border-accent focus:outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warn"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success/12 text-success",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={cn("skeleton", className)} style={style} />
);

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("h-5 w-5 animate-spin text-muted", className)} />;

/** An empty screen is an invitation to act: one sentence of context, one action. */
export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex animate-fade-in flex-col items-start py-16">
      <div className="mb-5 text-accent">{icon}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>;
}
/** @deprecated use Panel */
export const Card = Panel;

/** Deterministic frosted-glass fill for a sealed photo, derived from its CID. */
export function frostStyle(seed: string): React.CSSProperties {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const r = (n: number) => ((h >>> n) & 0xff) / 255;
  const hue = 182 + r(0) * 22; // glacial teal to ice blue
  return {
    background: [
      `radial-gradient(circle at ${20 + r(8) * 60}% ${15 + r(16) * 50}%, hsl(${hue} 55% 92% / .95), transparent 55%)`,
      `radial-gradient(circle at ${r(24) * 100}% ${60 + r(4) * 40}%, hsl(${hue + 8} 36% 68% / .85), transparent 60%)`,
      `linear-gradient(${Math.round(r(12) * 360)}deg, hsl(${hue - 8} 30% 84%), hsl(${hue + 6} 32% 74%))`,
    ].join(","),
  };
}

/** Accessible modal on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-surface p-0 text-fg shadow-[0_24px_60px_-20px_rgb(15_23_27/0.45)]",
        "backdrop:bg-[#0f171b]/55 backdrop:backdrop-blur-[3px] open:animate-rise",
        className,
      )}
    >
      {open && (
        <div className="p-6 sm:p-7">
          {(title || description) && (
            <div className="mb-6 pr-10">
              {title && <h2 className="text-xl font-semibold">{title}</h2>}
              {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
            </div>
          )}
          <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
