'use client';

import React from 'react';
import { ButtonProps } from '@/types';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  // Clases base para el botón siguiendo Tailwind v4 y DaisyUI v5
  const baseClass = 'btn font-semibold transition-all duration-200 active:scale-98 flex items-center justify-center gap-1.5';

  // Configuración de variantes del botón
  const variantClasses = {
    primary: 'btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 shadow-md hover:shadow-lg',
    secondary: 'btn-secondary',
    outline: 'btn-outline border-base-300 hover:bg-base-200 text-base-content',
    ghost: 'btn-ghost',
    error: 'btn-error text-white bg-red-600 hover:bg-red-700 border-none shadow-sm',
    success: 'btn-success text-white bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm',
    warning: 'btn-warning text-white bg-amber-500 hover:bg-amber-600 border-none shadow-sm',
  };

  // Configuración de tamaños
  const sizeClasses = {
    xs: 'btn-xs min-h-[1.75rem] h-7 text-[10px] px-2.5 rounded-lg',
    sm: 'btn-sm min-h-[2.25rem] h-9 text-xs px-3.5 rounded-xl',
    md: 'btn-md min-h-[2.75rem] h-11 text-sm px-5 rounded-2xl',
    lg: 'btn-lg min-h-[3.25rem] h-13 text-base px-6 rounded-3xl',
  };

  const resolvedVariant = variantClasses[variant] || variantClasses.primary;
  const resolvedSize = sizeClasses[size] || sizeClasses.md;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseClass} ${resolvedVariant} ${resolvedSize} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin shrink-0" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
