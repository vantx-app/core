export const getScoreCircleColor = (score: number | null | undefined): string => {
  if (score == null) return "text-base-content/20 stroke-base-300";
  if (score >= 85) return "text-success stroke-success";
  if (score >= 70) return "text-warning stroke-warning";
  return "text-error stroke-error";
};

export const getScoreBadgeColor = (score: number | null | undefined): string => {
  if (score == null) return "badge-ghost text-base-content/50 border-base-200/80";
  if (score >= 85) return "badge-success text-white";
  if (score >= 70) return "badge-warning text-white";
  return "badge-error text-white";
};

export const getScoreTextColor = (score: number | null | undefined): string => {
  if (score == null) return "text-base-content/40";
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-error";
};

export const getVehicleStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "ONLINE":
    case "ACTIVE":
      return "badge-success text-white";
    case "MAINTENANCE":
    case "IN_MAINTENANCE":
      return "badge-warning text-white";
    default:
      return "badge-ghost";
  }
};
const baseFormatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  method:
    | "toLocaleDateString"
    | "toLocaleTimeString"
    | "toLocaleString" = "toLocaleDateString",
  timeZone?: string,
): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  const opt = { ...options };
  if (timeZone) {
    opt.timeZone = timeZone;
  }
  return d[method]("es-ES", opt);
};

export const formatDecimalHours = (
  hoursDecimal: number | null | undefined,
  useMinWord = false,
): string => {
  if (hoursDecimal == null || isNaN(hoursDecimal) || hoursDecimal <= 0) {
    return useMinWord ? "0 min" : "0m";
  }
  const hrs = Math.floor(hoursDecimal);
  const mins = Math.round((hoursDecimal - hrs) * 60);
  const finalHrs = mins === 60 ? hrs + 1 : hrs;
  const finalMins = mins === 60 ? 0 : mins;

  if (finalHrs === 0) {
    return useMinWord ? `${finalMins} min` : `${finalMins}m`;
  }
  if (finalMins === 0) {
    return `${finalHrs}h`;
  }
  return `${finalHrs}h ${finalMins}m`;
};

export const formatHours = (
  hoursDecimal: number | null | undefined,
): string => {
  return formatDecimalHours(hoursDecimal, false);
};

export const formatDate = (dateString: string | Date): string => {
  return baseFormatDate(dateString, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatDateOnly = (dateString: string | Date): string => {
  return baseFormatDate(
    dateString,
    {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    },
    "toLocaleDateString",
    "UTC",
  );
};

/**
 * Driver Document verification status helpers
 */
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

/**
 * Marketplace Application status helpers
 */
export const getMarketplaceAppStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "PENDING":
      return "badge-warning text-white";
    case "APPROVED":
      return "badge-success text-white";
    case "REJECTED":
      return "badge-error text-white";
    case "WITHDRAWN":
      return "badge-ghost text-base-content/60";
    default:
      return "badge-ghost";
  }
};

export const getMarketplaceAppStatusText = (status: string): string => {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "APPROVED":
      return "Aprobado";
    case "REJECTED":
      return "Rechazado";
    case "WITHDRAWN":
      return "Retirado";
    default:
      return status;
  }
};

/**
 * Marketplace Job Listing status helper
 */
export const getListingStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "ACTIVE":
      return "badge-success text-white";
    case "FILLED":
      return "badge-info text-white";
    case "PAUSED":
      return "badge-warning text-white";
    case "INACTIVE":
      return "badge-ghost text-base-content/60";
    default:
      return "badge-ghost";
  }
};

/**
 * Organization Subscription status helper
 */
export const getOrgSubscriptionBadgeClass = (
  status: string,
  isExpired: boolean,
): string => {
  if (status === "ACTIVE" && !isExpired) {
    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  }
  if (status === "PENDING_ACTIVATION") {
    return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
  }
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
};

/**
 * Trip-specific formatting helpers
 */
export const getLocalDateOnlyLabel = (dateStr: string): string => {
  const label = baseFormatDate(dateStr, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatTripDate = (dateString: string): string => {
  return baseFormatDate(
    dateString,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    },
    "toLocaleString",
  );
};

export const formatTimeOnly = (dateString: string): string => {
  return baseFormatDate(
    dateString,
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    },
    "toLocaleTimeString",
  );
};

export const formatTripDuration = (
  start: string,
  end: string | null,
): string => {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const hoursDecimal = (e - s) / 3600000;
  return formatDecimalHours(hoursDecimal, true);
};
