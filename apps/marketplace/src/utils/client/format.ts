export const getDriverDocStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-800/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold px-3 py-1";
    case "PENDING_VALIDATION":
      return "bg-blue-800/10 text-blue-800 border-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 font-bold px-3 py-1 animate-pulse";
    case "PENDING_MANUAL_REVIEW":
      return "bg-amber-800/10 text-amber-800 border-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-bold px-3 py-1";
    case "REJECTED":
      return "bg-red-800/10 text-red-800 border-red-500/20 dark:text-red-300 dark:border-red-500/40 font-bold px-3 py-1";
    default:
      return "bg-base-200 text-base-content/60 font-bold px-3 py-1";
  }
};

export const getDriverDocStatusText = (status: string): string => {
  switch (status) {
    case "APPROVED":
      return "Aprobado";
    case "PENDING_VALIDATION":
      return "Verificando...";
    case "PENDING_MANUAL_REVIEW":
      return "En Revisión Manual";
    case "REJECTED":
      return "Rechazado";
    default:
      return "Pendiente de Subida";
  }
};

export const getInitials = (name: string): string => {
  return (
    name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
};

export const maskDriverName = (driver: any, userRole?: string): string => {
  const isOwner =
    userRole === "OWNER" || userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  if (isOwner) {
    return driver.name || `${driver.firstName} ${driver.lastName}`;
  }
  const fName = driver.firstName || "Conductor";
  const lInitial = driver.lastName ? `${driver.lastName[0]}.` : "";
  return `${fName} ${lInitial}`.trim();
};

export const getDocStatusBadge = (driver: any, type: string): string => {
  const doc = driver.documents?.find((d: any) => d.type === type);
  const status = doc?.status || "PENDING_UPLOAD";

  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-800/10 dark:text-emerald-300 dark:border-emerald-500/20";
  }
  if (status === "PENDING_VALIDATION" || status === "PENDING_MANUAL_REVIEW") {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-800/10 dark:text-amber-300 dark:border-amber-500/20 animate-pulse";
  }
  return "bg-slate-50 text-slate-500 border-slate-200";
};

export const getDocStatusText = (driver: any, type: string): string => {
  const doc = driver.documents?.find((d: any) => d.type === type);
  const status = doc?.status || "PENDING_UPLOAD";

  if (status === "APPROVED") return "Verificado";
  if (status === "PENDING_VALIDATION" || status === "PENDING_MANUAL_REVIEW")
    return "Pendiente Revisión";
  if (status === "REJECTED") return "Rechazado";
  return "Sin Verificar";
};

export const getCategoryText = (cat: string): string => {
  switch (cat) {
    case "HEAVY_DUTY":
      return "Carga Pesada";
    case "LIGHT_COMMERCIAL":
      return "Distribución Ligera";
    case "PASSENGER":
      return "Vehículo de Pasajeros";
    case "MACHINERY":
      return "Maquinaria Pesada";
    default:
      return cat;
  }
};

export const getFuelText = (fuel: string | null): string => {
  switch (fuel) {
    case "DIESEL":
      return "Diésel";
    case "GASOLINE":
      return "Gasolina";
    case "ELECTRIC":
      return "Eléctrico";
    case "HYBRID":
      return "Híbrido";
    default:
      return fuel || "N/A";
  }
};
