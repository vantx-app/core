"use client";

import { MapWrapperTrackingDetails } from "@/types";
import dynamic from "next/dynamic";

const TrackingMapComponent = dynamic(() => import("./TrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-base-100">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  ),
});

export default function TrackingMapWrapper({
  id,
  initialDetails,
}: {
  id: string;
  initialDetails: MapWrapperTrackingDetails;
}) {
  return <TrackingMapComponent id={id} initialDetails={initialDetails} />;
}
