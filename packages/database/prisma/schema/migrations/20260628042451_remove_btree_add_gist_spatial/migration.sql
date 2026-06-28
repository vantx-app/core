-- DropIndex
DROP INDEX "MapLink_minLat_maxLat_minLng_maxLng_idx";

-- CreateSpatialIndex
CREATE INDEX "MapLink_spatial_gist_idx" ON "MapLink" USING gist (box(point("minLng", "minLat"), point("maxLng", "maxLat")));
