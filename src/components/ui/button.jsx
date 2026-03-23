import * as React from "react";

const Button = React.forwardRef(
  ({ className = "", variant = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2";

    const variants = {
      default: "bg-slate-900 text-white shadow hover:bg-slate-800",
      outline: "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
      ghost: "text-slate-700 hover:bg-slate-100",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant] || variants.default} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };