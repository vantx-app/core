-- AlterTable
ALTER TABLE "Driver" ALTER COLUMN "status" SET DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "hasOptionToBuy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isListed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listingDescription" TEXT,
ADD COLUMN     "listingPrice" DOUBLE PRECISION;
