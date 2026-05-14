import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

/**
 * Shared button primitive. The primary variant carries the single permitted
 * shadow in the system — a hover-lift.
 */
export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'font-sans text-[15px] font-medium px-7 py-3 rounded-full transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none';
  const styles =
    variant === 'primary'
      ? 'bg-fg text-bg hover:shadow-lift hover:-translate-y-px active:translate-y-0'
      : 'bg-transparent text-dim hover:text-fg border border-line-2';
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
