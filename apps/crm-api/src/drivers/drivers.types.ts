import { Prisma } from '@prisma/client';

// The full Driver shape returned by findAll (with globalStats and assignments)
export type DriverWithGlobalStats = Prisma.DriverGetPayload<{
  include: {
    globalStats: true;
    assignments: {
      include: {
        vehicle: {
          select: {
            orgId: true;
          };
        };
      };
    };
  };
}>;

// The full Driver shape returned by findOne (with globalStats and scoreSnapshots)
export type DriverWithDetails = Prisma.DriverGetPayload<{
  include: {
    globalStats: true;
    scoreSnapshots: true;
  };
}>;

// The full Driver shape returned by findAllByOrgId
export type DriverWithOrgAssignments = Prisma.DriverGetPayload<{
  include: {
    globalStats: true;
    assignments: {
      include: {
        vehicle: true;
      };
    };
  };
}>;

// The full Driver shape returned by findStatsByUserId
export type DriverWithStats = Prisma.DriverGetPayload<{
  include: {
    globalStats: true;
    scoreSnapshots: true;
    assignments: {
      include: {
        vehicle: true;
      };
    };
  };
}>;

// A union of all driver types that formatDriver accepts
export type FormattableDriver =
  | DriverWithGlobalStats
  | DriverWithDetails
  | DriverWithOrgAssignments
  | DriverWithStats;

export interface MaskedDriverGlobalStats {
  id: string;
  driverId: string;
  totalKm: number;
  totalHours: number;
  totalSnapshots: number;
  globalSafetyScore: number | null;
  globalEcoScore: number | null;
  globalAssetScore: number | null;
  globalOverallScore: number | null;
  lastUpdated: Date;
}

// The output of formatDriver — adds the computed `name` field and overrides globalStats to be nullable for masking
export type FormattedDriver<T extends FormattableDriver = FormattableDriver> =
  Omit<T, 'globalStats'> & {
    name: string;
    globalStats: MaskedDriverGlobalStats | null;
  };
