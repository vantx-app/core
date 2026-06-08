import FleetMapWrapper from "@/components/FleetMapWrapper";
import { Suspense } from "react";

// app/map/page.tsx
export default async function MapPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          }
        >
          <FleetMapWrapper />
        </Suspense>
      </div>
    </div>
  );
}
