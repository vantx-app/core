'use client';

import { BackButtonProps } from '@/types';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export function BackButton({
  fallbackHref,
  className = "inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary transition-colors duration-200",
  children,
  icon = <ChevronLeft className="size-4" />,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // Check if there is internal session history (Next.js tracks this in window.history.state)
    const hasHistory =
      typeof window !== 'undefined' &&
      window.history.state &&
      typeof window.history.state === 'object' &&
      window.history.state.idx > 0;

    if (hasHistory) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className}
    >
      {icon}
      {children}
    </button>
  );
}
