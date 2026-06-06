'use client';

import { useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/utils/enums';

export function ModeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile, loadingProfile } = useAuth();

  const containerRef = useRef<HTMLDivElement>(null);

  const isEligibleRole =
    profile?.role === ROLES.SUPER_ADMIN ||
    profile?.role === ROLES.OWNER ||
    profile?.role === ROLES.ADMIN;
  const hasDriverProfile = isEligibleRole && profile?.driver;

  const isDriverView = searchParams.get('view') === 'driver';

  if (loadingProfile || !hasDriverProfile) {
    return null;
  }

  const handleToggle = (view: 'admin' | 'driver') => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === 'driver') {
      params.set('view', 'driver');
    } else {
      params.delete('view');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleToggle(isDriverView ? 'admin' : 'driver');
    }
  };

  return (
    <div className="p-2 border-t border-base-300 bg-base-100/50 flex justify-center w-full">
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Cambiar vista de rol"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className="flex w-full max-w-[320px] p-0.5 bg-base-200 rounded-full border border-base-300 gap-0.5 active:outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shrink-0"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!isDriverView}
          onClick={() => handleToggle('admin')}
          className={`flex-1 px-2 py-1 text-[11px] font-bold rounded-full transition-all duration-350 min-h-[36px] cursor-pointer flex items-center justify-center ${!isDriverView
            ? 'bg-blue-700 text-white shadow-sm'
            : 'text-base-content/75 hover:bg-base-300/50'
            }`}
          style={!isDriverView ? { backgroundColor: '#1d4ed8' } : undefined}
        >
          Vista Admin
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isDriverView}
          onClick={() => handleToggle('driver')}
          className={`flex-1 px-2 py-1 text-[11px] font-bold rounded-full transition-all duration-350 min-h-[36px] cursor-pointer flex items-center justify-center ${isDriverView
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'text-base-content/75 hover:bg-base-300/50'
            }`}
          style={isDriverView ? { backgroundColor: '#10b981' } : undefined}
        >
          Vista Conductor
        </button>
      </div>
    </div>
  );
}
