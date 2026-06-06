'use client';

import { DashboardStatCardProps } from '@/types';
import React from 'react';
import Link from 'next/link';

export function DashboardStatCard({
  icon,
  label,
  value,
  href,
  className = '',
}: DashboardStatCardProps) {
  // Base classes for the card body
  const bodyContent = (
    <div className="card-body p-5 flex flex-row items-center gap-4">
      {icon}
      <div className="min-w-0 flex-1">
        <span className="text-base-content/50 text-[10px] md:text-xs font-bold uppercase tracking-wider block">
          {label}
        </span>
        <span className="text-xl md:text-2xl font-black text-base-content block truncate">
          {value}
        </span>
      </div>
    </div>
  );

  const containerClasses = `glass-card hover:border-primary/25 hover:scale-[1.01] transition-all duration-300 block ${className}`;

  if (href) {
    return (
      <Link href={href} className={`${containerClasses} active:scale-[0.98] cursor-pointer`}>
        {bodyContent}
      </Link>
    );
  }

  return <div className={containerClasses}>{bodyContent}</div>;
}
