'use client';

import { TrackPageTrackingDetails } from '@/types';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import TrackingMapWrapper from '@/components/TrackingMapWrapper';

export default function PublicTrackingPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<TrackPageTrackingDetails | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        // Direct axios call to the public REST endpoint
        const response = await axios.get(`/api/vehicles/tracking-links/public/${id}`);
        setDetails(response.data);
      } catch (err: any) {
        console.error('Error fetching public tracking details:', err);
        setError('El enlace de rastreo ha expirado o no es válido');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-base-100 gap-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-sm font-semibold text-base-content/60 animate-pulse">
          Cargando mapa de rastreo...
        </p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-base-100 p-6">
        <div className="max-w-md w-full bg-base-200/50 backdrop-blur-md border border-base-300/40 p-8 rounded-2xl shadow-xl text-center space-y-4">
          <div className="flex justify-center">
            <div className="size-16 rounded-full bg-error/10 flex items-center justify-center text-error">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-base-content tracking-tight">
            Acceso Denegado
          </h2>
          <p className="text-sm text-base-content/70">
            {error || 'El enlace de rastreo ha expirado o no es válido'}
          </p>
          <div className="pt-2">
            <p className="text-[10px] text-base-content/40 uppercase font-bold tracking-wider">
              VantX Fleet Tracking
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <TrackingMapWrapper id={id} initialDetails={details} />
    </div>
  );
}
