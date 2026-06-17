/**
 * Panama official driver's license categories (ATTT classification).
 * Values correspond to the unique single categories.
 */
export type PanamaLicenseType =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E1"
  | "E2"
  | "E3"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J";

export const PANAMA_LICENSE_TYPE_OPTIONS: PanamaLicenseType[] = [
  "A",
  "B",
  "C",
  "D",
  "E1",
  "E2",
  "E3",
  "F",
  "G",
  "H",
  "I",
  "J",
];

/**
 * Panama official driver's license categories with their Spanish labels (ATTT classification).
 * Used for user-facing select options, filtering, and detail displays.
 */
export const PANAMA_LICENSE_TYPES: {
  value: PanamaLicenseType;
  label: string;
}[] = [
  { value: "A", label: "A — Bicicletas" },
  { value: "B", label: "B — Motocicletas" },
  {
    value: "C",
    label:
      "C — Automóviles, camionetas y minivans particulares (hasta 9 pasajeros)",
  },
  {
    value: "D",
    label:
      "D — Camiones livianos (hasta 8 ton) y autobuses privados (hasta 16 pasajeros)",
  },
  { value: "E1", label: "E1 — Transporte selectivo (taxis)" },
  {
    value: "E2",
    label: "E2 — Autobuses de transporte público (hasta 16 pasajeros)",
  },
  {
    value: "E3",
    label: "E3 — Autobuses de transporte público (más de 16 pasajeros)",
  },
  {
    value: "F",
    label:
      "F — Camiones unitarios de más de 8 ton y autobuses de más de 16 pasajeros",
  },
  { value: "G", label: "G — Vehículos articulados (mulas)" },
  {
    value: "H",
    label: "H — Transporte de carga pesada de sustancias peligrosas",
  },
  { value: "I", label: "I — Equipo pesado (agrícola e industrial)" },
  {
    value: "J",
    label:
      "J — Autobuses de transporte colectivo público de pasajeros de empresas públicas",
  },
];
