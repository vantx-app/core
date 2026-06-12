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
