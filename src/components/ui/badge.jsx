import * as React from "react";

function Badge({ className = "", variant = "default", ...props }) {
  const variants = {
    default: "border-transparent bg-slate-900 text-white shadow-sm hover:bg-slate-800",
    secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200",
    destructive: "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700",
    outline: "border border-slate-200 bg-white text-slate-700",
  };

  return (
    <div
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 ${variants[variant] || variants.default} ${className}`}
      {...props}
    />
  );
}

export { Badge };