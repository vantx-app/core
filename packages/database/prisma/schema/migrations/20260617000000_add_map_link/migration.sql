-- CreateTable
CREATE TABLE "MapLink" (
    "linkId" TEXT NOT NULL,
    "functionalClass" INTEGER NOT NULL,
    "speedLimit" INTEGER NOT NULL,
    "geometry" TEXT NOT NULL,
    "minLat" DOUBLE PRECISION NOT NULL,
    "maxLat" DOUBLE PRECISION NOT NULL,
    "minLng" DOUBLE PRECISION NOT NULL,
    "maxLng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapLink_pkey" PRIMARY KEY ("linkId")
);

-- CreateIndex
CREATE INDEX "MapLink_minLat_maxLat_minLng_maxLng_idx" ON "MapLink"("minLat", "maxLat", "minLng", "maxLng");
