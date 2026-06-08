// app/(dashboard)/loading.tsx
import React from "react";

export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in-delayed">
      {/* Title Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-8 w-1/3 rounded-lg" />
          <div className="skeleton h-4 w-1/2 rounded-md" />
        </div>
        <div className="skeleton h-10 w-32 rounded-lg shrink-0" />
      </div>

      {/* Performance Scores Skeleton - Mobile view (progress bars) vs Desktop (radial circles) */}
      {/* Mobile view progress bars skeleton */}
      <div className="md:hidden card bg-base-100/50 backdrop-blur-md border border-base-200 p-6 space-y-4 shadow-md">
        <div className="skeleton h-4 w-1/4 rounded-md" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="skeleton h-3 w-1/4 rounded" />
                <div className="skeleton h-3 w-8 rounded" />
              </div>
              <div className="skeleton h-2 w-full rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop view radial gauges skeleton */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="card bg-base-100/50 backdrop-blur-md border border-base-200 p-6 flex flex-col items-center justify-between min-h-[220px] shadow-md"
          >
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-3 w-36 rounded" />
            </div>
            <div className="skeleton size-24 rounded-full" />
            <div className="skeleton h-6 w-32 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card bg-base-100/50 backdrop-blur-md border border-base-200 p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="skeleton size-12 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton h-6 w-1/3 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Risk Alerts & Fleet Health Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Alerts */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4">
          <div className="space-y-2">
            <div className="skeleton h-6 w-1/3 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <div className="space-y-1.5 flex-1">
                  <div className="skeleton h-4 w-1/3 rounded" />
                  <div className="skeleton h-3 w-1/4 rounded" />
                </div>
                <div className="skeleton h-6 w-16 rounded-md shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Health / Vehicles */}
        <div className="card bg-base-100/60 backdrop-blur-sm border border-base-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-2 flex-1">
              <div className="skeleton h-6 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
            <div className="skeleton h-4 w-16 rounded" />
          </div>
          <div className="space-y-4 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <div className="space-y-1.5 flex-1">
                  <div className="skeleton h-4 w-1/2 rounded" />
                  <div className="skeleton h-3 w-1/4 rounded" />
                </div>
                <div className="skeleton h-6 w-16 rounded-md shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
