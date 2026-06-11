"use client";

import { useState } from "react";
import { CreditCard, Info } from "lucide-react";

export interface IdDocumentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

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
          <span className="label-text font-bold text-xs text-slate-700 flex items-center gap-1.5">
            {label}
            <div className="group relative inline-block">
              <Info className="size-3.5 text-slate-400 hover:text-blue-600 transition-colors cursor-help" />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-700 opacity-0 invisible shadow-md transition-all duration-200 group-hover:opacity-100 group-hover:visible">
                {current.hint}
                <div className="absolute top-full left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white border-b border-r border-slate-200" />
              </div>
            </div>
          </span>
        </label>
      )}
      <div className="flex flex-col gap-2">
        <select
          className="select select-bordered bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:border-slate-400 focus:outline-none transition-all duration-200 h-[42px] min-h-0 py-0 text-sm w-full"
          defaultValue="PA_CITIZEN"
          onChange={(e) => setDocType(e.target.value as DocType)}
          disabled={disabled}
          aria-label="Tipo de documento"
        >
          {DOC_TYPES.map((dt) => (
            <option
              key={dt.value}
              value={dt.value}
              className="bg-white text-slate-800"
            >
              {dt.label}
            </option>
          ))}
        </select>

        <div className="relative w-full">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className={`input input-bordered w-full font-mono text-sm bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:border-slate-400 focus:outline-none transition-all duration-200 h-[42px] min-h-0 ${error ? "input-error border-red-500 bg-red-50/50 text-red-900" : ""}`}
            placeholder={current.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            autoComplete="off"
          />
        </div>
      </div>

      {error && <span className="text-error text-xs">{error}</span>}
    </div>
  );
}
