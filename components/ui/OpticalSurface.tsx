import type { HTMLAttributes } from "react";

export function OpticalSurface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`optical-surface ${className}`.trim()} {...props} />;
}
