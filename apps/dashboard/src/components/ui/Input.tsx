"use client";

import React, { forwardRef } from "react";
import { InputProps } from "@/types";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = "",
      wrapperClassName = "",
      type = "text",
      disabled,
      required,
      id,
      ...props
    },
    ref,
  ) => {
    // Generar un ID único si no se proporciona para accesibilidad
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`form-control w-full ${wrapperClassName}`}>
        {/* Label superior */}
        {label && (
          <label className="label py-1" htmlFor={inputId}>
            <span className="label-text font-bold text-xs text-base-content/85">
              {label}
              {required && <span className="text-error ml-0.5">*</span>}
            </span>
          </label>
        )}

        {/* Contenedor del Input con soporte para iconos a los lados */}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 flex items-center justify-center pointer-events-none">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            type={type}
            id={inputId}
            disabled={disabled}
            className={`input input-bordered w-full focus:ring-2 transition-all duration-200 text-sm h-11 rounded-2xl
              ${leftIcon ? "pl-11" : "pl-4"}
              ${rightIcon ? "pr-11" : "pr-4"}
              ${
                error
                  ? "input-error border-red-500 focus:ring-red-500/20 focus:border-red-500"
                  : "focus:ring-primary/20 focus:border-primary"
              }
              ${className}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-content/40 flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Mensaje de error o texto de ayuda */}
        {error ? (
          <span className="text-[10px] text-error mt-1 font-semibold flex items-center gap-1 pl-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {error}
          </span>
        ) : helperText ? (
          <span className="text-[10px] text-base-content/40 mt-1 pl-0.5">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
