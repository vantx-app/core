'use client';
import { useAuth } from '@/context/AuthContext';
import { NAV_LINKS } from '@/utils/client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ROLES } from '@/utils/enums';
import { useTranslation } from '@/hooks/useTranslation';

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const { t } = useTranslation();

  const isDriverView = searchParams.get('view') === 'driver';
  const effectiveRole = isDriverView ? ROLES.DRIVER : role;
  const targetOrgId = searchParams.get('targetOrgId');

  const visibleLinks = NAV_LINKS.filter(link => {
    const rolesToShow = link.menuAllowedRoles || link.allowedRoles;
    if (!rolesToShow.includes(effectiveRole)) return false;
    if ('hidden' in link && link.hidden) return false;
    return true;
  });

  return (
    <div
      className="fixed bottom-0 left-0 w-full glass-nav z-[60] flex flex-row items-center justify-evenly lg:hidden h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] group-has-[input:focus]:hidden group-has-[textarea:focus]:hidden pointer-events-auto"
      style={{ pointerEvents: 'auto' }}
    >
      {visibleLinks.map((link) => {
        const isActive =
          link.href === '/'
            ? pathname === '/' // Si es el root, exigimos match exacto
            : pathname === link.href || pathname.startsWith(`${link.href}/`); // Match exacto o sub-ruta con slash
        const Icon = link.icon;

        const baseHref = targetOrgId
          ? `${link.href}${link.href.includes('?') ? '&' : '?'}targetOrgId=${targetOrgId}`
          : link.href;

        const href = isDriverView
          ? `${baseHref}${baseHref.includes('?') ? '&' : '?'}view=driver`
          : baseHref;

        return (
          <Link
            key={link.href}
            href={href}
            className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive ? 'text-primary' : 'text-base-content/70 hover:text-base-content'
              }`}
          >
            <div className={`relative flex items-center justify-center px-5 py-1 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/10 text-primary scale-100' : 'bg-transparent text-base-content/70 scale-95'
              }`}>
              <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">{t(link.key || link.label)}</span>
          </Link>
        );
      })}
    </div>
  );
}