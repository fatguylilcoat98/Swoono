import { HTMLAttributes, ReactNode, forwardRef } from "react";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "default" | "strong";
  glow?: boolean;
};

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { children, variant = "default", glow = false, className = "", ...rest },
    ref,
  ) {
    const base = variant === "strong" ? "glass-strong" : "glass";
    const glowClass = glow ? "shadow-glow" : "shadow-glass";
    return (
      <div
        ref={ref}
        className={`rounded-2xl ${base} ${glowClass} ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

export default GlassPanel;
