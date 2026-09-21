import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "primary" | "quiet" | "danger" };

export function Button({ tone = "default", className = "", ...props }: Props) {
  return <button className={`button button--${tone} ${className}`.trim()} {...props} />;
}
