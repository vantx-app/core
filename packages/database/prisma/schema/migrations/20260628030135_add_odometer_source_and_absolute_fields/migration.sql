-- CreateEnum
CREATE TYPE "OdometerSource" AS ENUM ('AUTO', 'ABSOLUTE', 'RELATIVE');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "isOdometerAbsolute" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "odometerSource" "OdometerSource" NOT NULL DEFAULT 'AUTO';
