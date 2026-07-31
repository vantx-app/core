import { ROLES } from "@/utils/enums";
import { ElementType } from "react";

/**
 * Clasificación oficial de licencias de conducir de la ATTT de Panamá.
 * Los valores corresponden a las categorías únicas. Los conductores pueden tener
 * múltiples categorías almacenadas como cadena separada por coma (ej. "C, D").
 */
import type { PanamaLicenseType } from "@vantx/ui";
export type { PanamaLicenseType };
export { PANAMA_LICENSE_TYPE_OPTIONS } from "@vantx/ui";

export interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}
export interface DashboardVehicle {
  id: string;
  alias?: string | null;
  plateNumber: string;
  status: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  deviceModel?: string;
  liveState?: {
    lastUpdate: string;
    currentStatus: string;
    [key: string]: unknown;
  } | null;
  assignments?: {
    id: string;
    driver: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      nationalId: string;
    };
  }[];
}

export interface RollupTelemetryStats {
  totalKm: number;
  totalEngineHours: number;
  idlingHours: number;
}

export interface DashboardDriver {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  nationalId?: string | null;
  globalStats?: {
    globalSafetyScore?: number | null;
    safetyScore?: number | null;
    globalEcoScore?: number | null;
    ecoScore?: number | null;
    globalAssetScore?: number | null;
    assetScore?: number | null;
    totalKm?: number | null;
    totalHours?: number | null;
    totalSnapshots?: number | null;
    lastUpdated?: string | Date | null;
  } | null;
  assignments?: {
    vehicle?: {
      orgId?: string;
    } | null;
  }[];
  rollupStats?: RollupTelemetryStats | null;
}

export interface DashboardOrganization {
  id: string;
  name: string;
  users?: { name: string }[];
  _count?: { vehicles: number };
}

export interface FleetVehicle {
  id: string;
  alias?: string | null;
  plateNumber: string;
  status: string;
  speed: number;
  angle: number;
  latitude: number;
  longitude: number;
  updatedAt: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  imei?: string | null;
  device?: Device | null;
  isFromSocket?: boolean;
  lastSocketUpdate?: number;
  ignition?: boolean;
  odometer?: number;
  fuelLevel?: number | null;
  liveState?: {
    lastLat?: number;
    lastLng?: number;
    lastSpeed?: number;
    currentStatus?: string;
    lastAngle?: number;
    lastUpdate?: string;
    lastIgnition?: boolean;
    lastOdometer?: number;
    lastFuelLevel?: number | null;
    unplugged?: boolean;
    [key: string]: unknown;
  } | null;
  assignments?: ActiveAssignment[];
}

export interface DriverScoreSnapshot {
  year: number;
  weekNumber: number;
  overallScore: number;
  safetyScore: number;
  ecoScore: number;
  assetScore: number;
  totalKm?: number | null;
  totalHours?: number | null;
}

export interface DriverStats {
  firstName: string;
  lastName: string;
  globalStats?: {
    globalSafetyScore?: number | null;
    safetyScore?: number | null;
    globalEcoScore?: number | null;
    ecoScore?: number | null;
    globalAssetScore?: number | null;
    assetScore?: number | null;
    globalOverallScore?: number | null;
    totalKm?: number | null;
    totalHours?: number | null;
    totalSnapshots?: number | null;
    lastUpdated?: string | Date | null;
  } | null;
  assignments?: {
    vehicle: {
      id: string;
      alias?: string | null;
      plateNumber: string;
      make?: string | null;
      model?: string | null;
      year?: number | null;
      vin?: string | null;
    };
  }[];
  scoreSnapshots?: DriverScoreSnapshot[];
  rollupStats?: RollupTelemetryStats | null;
}

export interface VehicleGlobalStats {
  id: string;
  vehicleId: string;
  totalKm: number;
  totalEngineHours: number;
  globalMaintenanceScore: number;
  globalFuelEfficiency: number;
  globalSafetyScore: number;
  globalOverallScore: number;
  lastUpdated: string;
}

export interface VehicleScoreSnapshot {
  id: string;
  vehicleId: string;
  weekNumber: number;
  year: number;
  maintenanceScore: number;
  fuelEfficiency: number;
  safetyScore: number;
  totalKm: number;
  idlingHours: number;
  totalTrips: number;
}

export interface DailyTelemetryRollup {
  id: string;
  date: string;
  vehicleId: string;
  driverId: string | null;
  driver?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    nationalId: string;
  } | null;
  totalKm: number;
  totalEngineHours: number;
  idlingHours: number;
  overspeedCount: number;
  overspeedSeverity: number;
  brakingCount: number;
  brakingSeverity: number;
  corneringCount: number;
  corneringSeverity: number;
  accelerationCount: number;
  accelerationSeverity: number;
  highRpmCount: number;
  highRpmSeverity: number;
  coldEngineStrainCount: number;
  coastingInNeutralCount: number;
  engineLuggingCount: number;
  highLoadStrainCount: number;
  criticalOverheatingCount: number;
  activeFaultCodesCount: number;
  deviceUnpluggedCount?: number;
}

export interface ActiveAssignment {
  id: string;
  vehicleId: string;
  driverId: string;
  from: string;
  to: string | null;
  driver: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    nationalId: string;
  };
}

export interface VehicleDetail {
  id: string;
  orgId: string;
  imei?: string | null;
  device?: Device | null;
  alias: string | null;
  plateNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  status: string;
  initialOdometer?: number;
  odometerSource?: "AUTO" | "ABSOLUTE" | "RELATIVE";
  isOdometerAbsolute?: boolean;
  deviceModel?: string;
  liveState?: {
    lastLat: number;
    lastLng: number;
    lastAngle: number;
    lastSpeed: number;
    lastIgnition: boolean;
    unplugged: boolean;
    currentStatus: string;
    lastOdometer: number | null;
    lastFuelLevel?: number | null;
    lastUpdate: string;
  } | null;
  VehicleGlobalStats?: VehicleGlobalStats | null;
  vehicleScoreSnapshots: VehicleScoreSnapshot[];
  DailyTelemetryRollup: DailyTelemetryRollup[];
  assignments: ActiveAssignment[];
  capabilities?: string[] | null;
}

export interface RuleDeductionDetail {
  code: string;
  pillar: "SAFETY" | "EFFICIENCY" | "ASSET_CARE";
  label: string;
  occurrences: number;
  severity: number;
  rawDeduction: number;
  appliedDeduction: number;
  trips?: Array<{
    tripId: string;
    startTime: string;
    endTime: string | null;
    occurrences: number;
    severity: number;
  }>;
}

export interface VehicleBreakdown {
  vehicleId: string;
  vehicleAlias: string | null;
  vehiclePlate: string;
  totalKm: number;
  totalHours: number;
  idlingHours: number;
  scores: {
    overallScore: number;
    safetyScore: number;
    ecoScore: number;
    assetScore: number;
  };
  ruleDeductions: RuleDeductionDetail[];
  pillarDeductions: {
    SAFETY: number;
    EFFICIENCY: number;
    ASSET_CARE: number;
  };
}

export interface ScoreBreakdown {
  overallScore: number;
  safetyScore: number;
  ecoScore: number;
  assetScore: number;
  totalKm: number;
  totalHours: number;
  idlingHours: number;
  vehicles: VehicleBreakdown[];
}

export interface FleetProviderProps {
  children: React.ReactNode;
  initialVehicles?: FleetVehicle[];
}

export interface FleetContextType {
  fleet: Record<string, FleetVehicle>;
  isConnected: boolean;
}

export interface TrackPageTrackingDetails {
  clientName: string | null;
  alias: string | null;
  plateNumber: string;
  lastLat: number | null;
  lastLng: number | null;
  lastAngle: number;
  currentStatus: string;
  globalOverallScore?: number | null;
}

export interface OwnerRegisterFormValues {
  email: string;
  password?: string;
  isDriver: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phone?: string;
  orgName: string;
}

export interface RegisterFormValues {
  nationalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
}

export interface MarketplaceDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  /** Single category (e.g. "D") or comma-joined multi-category (e.g. "C, D"). */
  licenseType: PanamaLicenseType | string | null;
  shareScoresPublicly: boolean;
  globalStats?: {
    globalSafetyScore: number;
    globalEcoScore: number;
  } | null;
  documents?: {
    type: string;
    status: string;
  }[];
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  compensation: string;
  routeType: "LOCAL" | "NATIONAL" | "INTERNATIONAL";
  status: "ACTIVE" | "FILLED" | "PAUSED" | "INACTIVE";
  minSafetyScore: number | null;
  requiredLicense: string | null;
  requirements: string[];
  createdAt: string;
  vehicleId: string;
  vehicle?: {
    make: string;
    model: string;
    year: number;
    plateNumber?: string;
  };
  organization?: {
    name: string;
  };
  _count?: {
    applications: number;
  };
}

export interface CreateListingVehicle {
  id: string;
  alias: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  assignments: any[];
}

export interface ApplicationListing {
  id: string;
  title: string;
  status: string;
  _count?: {
    applications: number;
  };
}

export interface MarketplaceApplication {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  createdAt: string;
  driverId: string;
  driver: {
    firstName: string;
    lastName: string;
    phone: string;
    userId: string;
    globalStats?: {
      globalSafetyScore: number | null;
      globalEcoScore: number | null;
    } | null;
    documents?: {
      type: string;
      status: string;
    }[];
  };
  listing: {
    id: string;
    title: string;
    compensation: string;
    routeType: string;
    organization?: {
      name: string;
    };
  };
}

export interface MarketplaceLayoutClientProps {
  children: React.ReactNode;
}

export interface OrganizationsPageOrg {
  id: string;
  name: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  paymentReceiptUrl?: string | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "ADMIN";
  }>;
  _count: {
    vehicles: number;
  };
}

export interface OrganizationsPageInvitation {
  id: string;
  token: string;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface DriversPageDriver {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  nationalId: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  globalStats: {
    globalSafetyScore: number;
    globalEcoScore: number;
    globalAssetScore: number;
    safetyScore?: number;
    ecoScore?: number;
    assetScore?: number;
    lastUpdated?: string | Date;
    totalSnapshots?: number;
  } | null;
  assignments: Array<{
    id: string;
    vehicle: {
      id: string;
      plateNumber: string;
      alias: string | null;
    };
  }>;
}

export interface PendingDocument {
  id: string;
  driverId: string;
  type: string;
  status: string;
  fileKey: string;
  fileUrl?: string | null;
  extractedData?: {
    scanMethod?: string;
    matchedNationalId?: boolean;
    matchedName?: boolean;
    extractedTextSnippet?: string;
    verificationFailureReason?: string;
    workerError?: string;
    diditSessionId?: string;
    diditUrl?: string;
    expirationDate?: string;
    diditDecision?: {
      status: string;
      id_verifications?: {
        status: string;
        document_type?: string;
        expiration_date?: string;
        extra_fields?: {
          dl_categories?: string;
          [key: string]: string | undefined;
        };
      }[];
      simulated?: boolean;
    } | null;
  } | null;
  createdAt: string;
  driver: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    nationalId: string;
  };
}

export interface PricingSettings {
  flatSaaSPrice: number;
  geolocationPrice: number;
  diagnosticsPrice: number;
}

export interface BillingUserProfile {
  id: string;
  name: string;
  role: string;
  organization?: {
    id: string;
    name: string;
    subscriptionStatus: string;
    subscriptionExpiresAt?: string | null;
    paymentMethod?: string | null;
    freeMatchCredits?: number;
    vehicles?: BillingVehicle[] | null;
  } | null;
}

export interface BillingVehicle {
  id: string;
  alias?: string | null;
  plateNumber: string;
  subscriptionTier: string;
  trialActivated?: boolean;
  trialExpiresAt?: string | null;
}

export interface VehicleMobileViewProps {
  vehicles: MobileViewVehicleSummary[];
  targetOrgId?: string;
}

export interface VehicleMobileViewAssignedDriver {
  nationalId: string;
  firstName?: string;
  lastName?: string;
}

export interface VehicleMobileViewOrg {
  id: string;
  name: string;
}

export interface MobileViewVehicleSummary {
  id: string;
  alias: string;
  status: "ACTIVE" | "IN_MAINTENANCE" | "DECOMMISSIONED";
  make: string;
  model: string;
  year: number;
  vin: string;
  plateNumber?: string;
  imei?: string;
  orgId?: string;
  initialOdometer?: number;
  assignments?: {
    id: string;
    driver: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      nationalId: string;
    };
  }[];
}

export interface NewVehiclePageOrg {
  id: string;
  name: string;
}

export interface AssignVehicleDriver {
  nationalId: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface VehicleViewPageProps {
  params: Promise<{ id: string }>;
}

export interface VehicleTripsPageProps {
  params: Promise<{ id: string }>;
}

export interface VehiclePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  organization?: {
    name: string;
  } | null;
  driver?: {
    id: string;
    nationalId: string;
    phone?: string | null;
  } | null;
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: ROLES;
  createdAt: string;
  driver?: {
    id: string;
    nationalId: string;
    phone?: string | null;
  } | null;
}

export interface DailyReport {
  id: string;
  date: string;
  vehicle: {
    alias: string | null;
    plateNumber: string;
  };
  totalKm: number;
  totalEngineHours: number;
  idlingHours: number;
  overspeedCount: number;
  brakingCount: number;
  corneringCount: number;
  accelerationCount: number;
  highRpmCount: number;
  coldEngineStrainCount: number;
  coastingInNeutralCount: number;
  engineLuggingCount: number;
  highLoadStrainCount: number;
  criticalOverheatingCount: number;
  activeFaultCodesCount: number;
  deviceUnpluggedCount?: number;
}

export interface ScoreSnapshot {
  year: number;
  weekNumber: number;
  overallScore: number;
  safetyScore: number;
  ecoScore: number;
  assetScore: number;
}

export interface SimpleDriver {
  id: string;
  name: string;
  nationalId: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface FailedRequest {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

export interface DriversTableDesktopProps {
  drivers: DriverSummary[];
}

export interface DriverSummary {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  nationalId: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  globalStats: {
    globalSafetyScore: number;
    globalEcoScore: number;
    globalAssetScore: number;
    safetyScore?: number;
    ecoScore?: number;
    assetScore?: number;
    lastUpdated?: string | Date;
    totalSnapshots?: number;
  } | null;
  assignments?: Array<{
    id: string;
    vehicle: {
      id: string;
      plateNumber: string;
      alias: string | null;
    };
  }>;
}

export interface ImeiScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (imei: string) => void;
}

export interface BackButtonProps {
  fallbackHref: string;
  className?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface MiniStatCardProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export interface IdDocumentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export interface MovementStatusBadgeProps {
  status?: string;
  speed?: number;
}

export interface ScoreProgressBarProps {
  score: number | null | undefined;
  label: string;
}

export interface DtcBadgeProps {
  count: number;
  showOk?: boolean;
}

export interface RadialScoreGaugeProps {
  score: number | null | undefined;
  title: string;
  subtitle?: string;
  footerText?: string;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  className?: string;
  noCard?: boolean;
  lastUpdated?: string | Date | null;
}

export interface WelcomeBannerProps {
  badgeText?: string;
  title: string;
  description: string;
  gradientClass?: string; // e.g. from-blue-700 via-indigo-700 to-purple-800
  icon?: React.ReactNode;
}

export interface DriverAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  nationalId?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export interface DashboardStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href?: string;
  className?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  className?: string; // Class applied directly to <table>
  wrapperClassName?: string; // Class applied to the outer div
  tbodyClassName?: string; // Class applied to <tbody>
  rowClassName?: string | ((row: T, index: number) => string);
  emptyState?: React.ReactNode;
  isLoading?: boolean;

  // Pagination props
  pagination?: boolean;
  pageSize?: number;
}

export interface TableColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  border?: boolean;
  className?: string;
}

export interface DriverInfoLabelProps {
  driver?: DriverInfoLabelDriverInfo | null;
  showNationalId?: boolean;
  className?: string;
}

export interface DriverInfoLabelDriverInfo {
  firstName?: string | null;
  lastName?: string | null;
  nationalId?: string | null;
}

export interface OrganizationsTableDesktopProps {
  organizations: TableOrgWithScore[];
  onEdit: (org: TableOrgWithScore) => void;
  onManageUsers: (org: TableOrgWithScore) => void;
  onActivate: (org: TableOrgWithScore) => void;
}

export interface TableOrgWithScore extends OrganizationSummary {
  avgSafety: number | null;
  ownerUser?: OrgUserSummary | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  users: OrgUserSummary[];
  paymentReceiptUrl?: string | null;
  _count: {
    vehicles: number;
  };
}

export interface OrgUserSummary {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN";
}

export interface MapWrapperTrackingDetails {
  clientName: string | null;
  alias: string | null;
  plateNumber: string;
  lastLat: number | null;
  lastLng: number | null;
  lastAngle: number;
  currentStatus: string;
  globalOverallScore?: number | null;
}

export interface VehicleTripsClientProps {
  vehicle: VehicleTripsVehicle;
  initialTrips: VehicleTripsTrip[];
}

export interface Coordinate {
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: string;
  ignition: boolean;
  harshAcceleration?: number;
  harshBraking?: number;
  harshCornering?: number;
}

export interface VehicleTripsVehicle {
  id: string;
  alias: string | null;
  plateNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
}

export interface VehicleTripsTrip {
  id: string;
  vehicleId: string;
  startTime: string;
  endTime: string | null;
  driver: VehicleTripsDriver | null;
  vehicle?: VehicleTripsVehicle | null;
  overallScore?: number;
  safetyScore?: number;
  ecoScore?: number;
  assetScore?: number;
  distanceKm?: number | null;
}

export interface VehicleTripsDriver {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
}

export interface CurrentUser {
  name: string;
  role: string;
  driver?: {
    nationalId: string;
  } | null;
}

export interface SuperAdminOrgWithScore extends DashboardOrganization {
  avgSafety: number | null;
  owner: string;
}

export interface SuperAdminDashboardProps {
  organizations: DashboardOrganization[];
  vehicles: DashboardVehicle[];
  drivers: DashboardDriver[];
}

export interface DriverDashboardProps {
  stats: DriverStats | null;
}

export interface AdminCardProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass: string;
  title: string;
  description: string;
  disabled?: boolean;
  disabledBadge?: string;
  disabledDescription?: React.ReactNode;
  disabledTitleAttr?: string;
  isExternalLink?: boolean;
}

export interface OwnerDashboardProps {
  vehicles: DashboardVehicle[];
  drivers: DashboardDriver[];
  targetOrgId?: string;
  fleetStats?: RollupTelemetryStats | null;
}

export interface UsersTableDesktopProps {
  users: FleetUserSummary[];
  actorRole: ROLES | null;
  onLink: (user: FleetUserSummary) => void;
  onUnlink: (userId: string) => void;
}

export interface FleetUserSummary {
  id: string;
  name: string;
  email: string;
  role: ROLES;
  createdAt: string;
  driver?: {
    id: string;
    nationalId: string;
    phone?: string | null;
  } | null;
}

export interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleName: string;
  onLinkGenerated: (newLink: TrackingLink) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export interface TrackingLink {
  id: string;
  vehicleId: string;
  clientName: string | null;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  trackingUrl: string;
}

export interface MobileFleetDrawerProps {
  isMobile: boolean;
  vehicleId: string | null;
  fleetCount: number;
  connectionStatus: string;
  snapPoint: string | number | null;
  setSnapPoint: (point: string | number | null) => void;
  handleVehicleSelection: (id?: string) => void;
  renderVehicleList: () => React.ReactNode;
  renderVehicleDetail: () => React.ReactNode;
  closedHeight: string;
  followedVehicleId?: string | null;
  onExitFollow?: () => void;
}

export interface TrackingMapProps {
  id: string;
  initialDetails: MapTrackingDetails;
}

export interface MapLiveLocationPayload {
  latitude?: number | null;
  lastLat?: number | null;
  longitude?: number | null;
  lastLng?: number | null;
  angle?: number | null;
  lastAngle?: number | null;
  status?: string | null;
  currentStatus?: string | null;
}

export interface MapTrackingDetails {
  clientName: string | null;
  alias: string | null;
  plateNumber: string;
  lastLat: number | null;
  lastLng: number | null;
  lastAngle: number;
  currentStatus: string;
  globalOverallScore?: number | null;
}

export interface TripMapProps {
  coordinates: Coordinate[];
  isOngoing?: boolean;
  isFullscreen?: boolean;
}

export interface VehicleTableDesktopProps {
  vehicles: FleetVehicleSummary[];
  targetOrgId?: string;
}

export interface FleetVehicleSummary {
  id: string;
  alias: string;
  status: "ACTIVE" | "IN_MAINTENANCE" | "DECOMMISSIONED";
  make: string;
  model: string;
  year: number;
  initialOdometer?: number;
  assignments?: {
    id: string;
    driver: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      nationalId: string;
    };
  }[];
}

export interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  activeSnapPoint?: string | number | null;
  setActiveSnapPoint?: (point: string | number | null) => void;
  dismissible?: boolean;
  modal?: boolean;
  height?: string;
  paddingBottom?: string;
}

export interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | number;
  variant?: "light" | "dark" | "auto";
}

export interface VehicleDetailClientProps {
  vehicle: VehicleDetail;
}

export interface DriverDocumentsCardProps {
  driverStats?: DriverDocumentsStats | null;
  onSync?: () => void;
}

export interface DriverDocumentsStats {
  /** Single category (e.g. "D") or comma-joined multi-category (e.g. "C, D"). */
  licenseType?: PanamaLicenseType | string | null;
}

export interface DriverDocument {
  id: string;
  type: string;
  status: string;
  fileUrl?: string | null;
  extractedData?: {
    verificationFailureReason?: string | null;
    expirationDate?: string | null;
    diditDecision?: {
      status?: string | null;
      id_verifications?:
        | {
            extra_fields?: {
              dl_categories?: string | null;
            } | null;
          }[]
        | null;
    } | null;
    diditUrl?: string | null;
  } | null;
}

export interface DriverProfileCardProps {
  stats: DriverProfileStats | null;
}

export interface DriverProfileStats {
  status: string;
  nationalId: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  assignments?: DriverAssignment[];
  shareScoresPublicly?: boolean;
}

export interface DriverAssignment {
  to: string | null;
  vehicle: AssignedVehicle;
}

export interface AssignedVehicle {
  alias?: string | null;
  plateNumber: string;
  make?: string | null;
  model?: string | null;
}

export interface VehicleFormProps {
  vehicleId?: string;
  targetOrgId?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export interface AssignDriverFormProps {
  vehicleId: string;
  initialDriver?: AssignVehicleDriver | null;
  onSuccess?: () => void;
}

export interface VehicleFormValues {
  orgId?: string;
  imei?: string;
  deviceId?: string;
  alias?: string;
  plateNumber: string;
  make?: string;
  model?: string;
  year?: number | "";
  currentOdometer?: string;
  odometerSource?: "AUTO" | "ABSOLUTE" | "RELATIVE";
  fuelType?: string;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "error"
    | "success"
    | "warning";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "neutral"
    | "success"
    | "warning"
    | "error"
    | "ghost"
    | "info";
  size?: "xs" | "sm" | "md" | "lg";
  outline?: boolean;
  children: React.ReactNode;
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "warning" | "error" | "info";
  title?: string;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
  border?: boolean;
  shadow?: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  children: React.ReactNode;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}

export interface NavLink {
  href: string;
  label: string;
  key: string;
  icon: ElementType;
  allowedRoles: ROLES[];
  menuAllowedRoles?: ROLES[];
  hidden?: boolean;
  overrideClassNames?: string;
  hideInMobileBottomNavForRoles?: ROLES[];
  isExternal?: boolean;
  hiddenOnMobile?: boolean;
}

export interface Device {
  id: string;
  imei: string;
  model: string;
  status: string;
  firmware?: string | null;
  source: string;
  lastSeen?: string | null;
  vehicleId?: string | null;
  simCardId?: string | null;
  simCard?: SimCard | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimCard {
  id: string;
  iccid: string;
  phoneNumber?: string | null;
  carrier?: string | null;
  createdAt: string;
  updatedAt: string;
}
