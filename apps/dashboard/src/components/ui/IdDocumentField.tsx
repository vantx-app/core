"use client";

import { IdDocumentFieldProps } from "@/types";
import { useState } from "react";
import { CreditCard } from "lucide-react";

type DocType =
  | "PA_CITIZEN"
  | "PA_FOREIGNER"
  | "PA_NATURALIZED"
  | "PASSPORT"
  | "FOREIGN_ID";

const DOC_TYPES: {
  value: DocType;
  label: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    value: "PA_CITIZEN",
    label: "🇵🇦 Cédula Panameña",
    placeholder: "Ej. 8-888-8888",
    hint: "Ciudadano panameño — formato #-###-####",
  },
  {
    value: "PA_FOREIGNER",
    label: "🇵🇦 Residente Extranjero (PE)",
    placeholder: "Ej. E-8-888888",
    hint: "Residente extranjero — formato E-#-######",
  },
  {
    value: "PA_NATURALIZED",
    label: "🇵🇦 Naturalizado (N)",
    placeholder: "Ej. N-88-888888",
    hint: "Cédula de naturalizado — formato N-##-######",
  },
  {
    value: "PASSPORT",
    label: "🌐 Pasaporte",
    placeholder: "Ej. AA0000000",
    hint: "Número de pasaporte internacional",
  },
  {
    value: "FOREIGN_ID",
    label: "🌐 ID Extranjero",
    placeholder: "Número de documento",
    hint: "Cédula, DPI, DNI u otro documento extranjero",
  },
];

export function IdDocumentField({
  value,
  onChange,
  disabled,
  error,
  label = "Documento de Identidad",
  required,
  className = "",
}: IdDocumentFieldProps) {
  const [docType, setDocType] = useState<DocType>("PA_CITIZEN");
  const current = DOC_TYPES.find((d) => d.value === docType)!;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="label py-0.5">
          <span className="label-text font-bold text-xs text-base-content/85">
            {label}
          </span>
        </label>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="select select-bordered select-sm h-10 text-xs shrink-0 w-full sm:w-[140px] md:w-40 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
          defaultValue="PA_CITIZEN"
          onChange={(e) => setDocType(e.target.value as DocType)}
          disabled={disabled}
          aria-label="Tipo de documento"
        >
          {DOC_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-0 w-full">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-base-content/40 pointer-events-none" />
          <input
            type="text"
            className={`input input-bordered w-full pl-9 font-mono text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${error ? "input-error" : ""}`}
            placeholder={current.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            autoComplete="off"
          />
        </div>
      </div>

      <p className="text-[10px] text-base-content/40 pl-0.5">{current.hint}</p>
      {error && <span className="text-error text-xs">{error}</span>}
    </div>
  );
}
