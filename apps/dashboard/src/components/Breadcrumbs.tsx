'use client';

import Link from 'next/link';
import { useSelectedLayoutSegments, useSearchParams } from 'next/navigation';

export default function Breadcrumbs() {
  const segments = useSelectedLayoutSegments();
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get('targetOrgId');
  const cleanSegments = segments.filter((segment) => !segment.startsWith('('));

  return (
    <nav aria-label="breadcrumb" className="hidden md:block breadcrumbs text-lg p-4">
      <ul>
        {/* Generación dinámica basada en la URL actual */}
        {cleanSegments.map((segment, index) => {
          // Reconstruimos la ruta acumulada hasta el nivel actual
          const basePath = `/${cleanSegments.slice(0, index + 1).join('/')}`;
          const href = targetOrgId ? `${basePath}?targetOrgId=${targetOrgId}` : basePath;
          const isLast = index === cleanSegments.length - 1;

          // Simple formateo visual: Capitalizar la primera letra
          const label = segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <li key={href}>
              {isLast ? (
                // El último nodo representa la página actual; no debe ser clickeable
                <span className="text-base-content/60 font-medium">{label}</span>
              ) : (
                <Link href={href}>{label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}