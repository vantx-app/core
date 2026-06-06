'use client';

import React from 'react';
import { CardProps } from '@/types';

export function Card({
  children,
  className = '',
  glass = true,
  hoverable = false,
  border = true,
  shadow = 'md',
  ...props
}: CardProps) {
  // Clases base para contenedores de tarjeta
  const baseClass = 'card rounded-3xl transition-all duration-300';
  
  // Fondo y blur si es glass o base-100 normal
  const bgClass = glass
    ? 'bg-base-100/60 backdrop-blur-sm'
    : 'bg-base-100';

  // Configuración de bordes
  const borderClass = border
    ? 'border border-base-200'
    : 'border-none';

  // Configuración de sombras
  const shadowClasses = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
  };

  const resolvedShadow = shadowClasses[shadow] || shadowClasses.md;

  // Animaciones al pasar el mouse por encima
  const hoverClass = hoverable
    ? 'hover:shadow-xl hover:border-primary/30 active:scale-[0.99]'
    : '';

  return (
    <div
      className={`${baseClass} ${bgClass} ${borderClass} ${resolvedShadow} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
