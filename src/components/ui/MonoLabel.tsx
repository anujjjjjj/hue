import type { ReactNode } from 'react';

interface MonoLabelProps {
  children: ReactNode;
  className?: string;
  /** letter-spacing in em; spec calls for 0.15–0.3em */
  tracking?: number;
}

/** Uppercase JetBrains Mono metadata label. */
export function MonoLabel({
  children,
  className = '',
  tracking = 0.25,
}: MonoLabelProps) {
  return (
    <span
      className={`font-mono text-[11px] uppercase ${className}`}
      style={{ letterSpacing: `${tracking}em` }}
    >
      {children}
    </span>
  );
}
