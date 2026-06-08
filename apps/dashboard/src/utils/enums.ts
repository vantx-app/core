export enum ROLES {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  DRIVER = "DRIVER",
}

export enum DriverDocumentType {
  NATIONAL_ID = "NATIONAL_ID",
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  POLICE_RECORD = "POLICE_RECORD",
}

export enum DriverDocumentStatus {
  PENDING_UPLOAD = "PENDING_UPLOAD",
  PENDING_VALIDATION = "PENDING_VALIDATION",
  APPROVED = "APPROVED",
  PENDING_MANUAL_REVIEW = "PENDING_MANUAL_REVIEW",
  REJECTED = "REJECTED",
}

/**
 * Panama official driver's license categories (ATTT classification).
 * Used in driver profiles and job listing requirements throughout the platform.
 */
export const PANAMA_LICENSE_TYPES: { value: string; label: string }[] = [
  { value: "A", label: "A — Bicicletas" },
  { value: "B", label: "B — Motocicletas" },
  { value: "C", label: "C — Automóviles y camionetas particulares" },
  {
    value: "D",
    label: "D — Camiones livianos (hasta 8 ton) y buses particulares",
  },
  { value: "E1", label: "E1 — Transporte selectivo (taxis)" },
  { value: "E2", label: "E2 — Buses comerciales (hasta 16 pasajeros)" },
  { value: "E3", label: "E3 — Buses comerciales (más de 16 pasajeros)" },
  {
    value: "F",
    label: "F — Camiones de más de 8 ton y buses de más de 16 pasajeros",
  },
  { value: "G", label: "G — Vehículos articulados (mulas/mulas cortas)" },
  { value: "H", label: "H — Transporte de carga peligrosa" },
  { value: "I", label: "I — Equipo pesado (agrícola y construcción)" },
  { value: "J", label: "J — Transporte de pasajeros por cable" },
];
