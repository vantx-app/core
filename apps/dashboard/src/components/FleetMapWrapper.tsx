'use client';

import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  ),
});

export default function FleetMapWrapper() {
  return <MapComponent />;
}
