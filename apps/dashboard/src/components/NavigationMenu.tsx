"use client"; // Asegúrate de tener esto arriba

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import { NAV_LINKS } from "@/utils/client";
import { useTranslation } from "@/hooks/useTranslation";

export function NavigationMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const { t } = useTranslation();

  const isDriverView = searchParams.get("view") === "driver";
  const effectiveRole = isDriverView ? ROLES.DRIVER : role;
  const targetOrgId = searchParams.get("targetOrgId");

  const visibleLinks = NAV_LINKS.filter((link) => {
    const rolesToShow = link.menuAllowedRoles || link.allowedRoles;
    if (!rolesToShow.includes(effectiveRole)) return false;
    if ("hidden" in link && link.hidden) return false;
    return true;
  });

  return (
    // 1. Añadimos un contenedor padre flex para separar la lista del switch de modo
    <div className="flex flex-col flex-1 justify-between h-full w-full">
      {/* 2. Tu lista de navegación original */}
      <ul className="menu flex-1 p-4 gap-2 text-base-content w-full">
        {visibleLinks.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;

          const baseHref = targetOrgId
            ? `${link.href}${link.href.includes("?") ? "&" : "?"}targetOrgId=${targetOrgId}`
            : link.href;

          const href = isDriverView
            ? `${baseHref}${baseHref.includes("?") ? "&" : "?"}view=driver`
            : baseHref;

          const LinkComponent = link.isExternal ? "a" : Link;

          return (
            <li
              key={link.href}
              className={`w-full ${link.overrideClassNames ? link.overrideClassNames : ""}`}
            >
              <LinkComponent
                href={href}
                className={`flex items-center justify-between w-full p-3 transition-colors rounded-lg ${
                  isActive
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-base-200"
                }`}
              >
                <span>{t(link.key || link.label)}</span>
                <Icon
                  className={`size-5 ${isActive ? "text-primary" : "text-base-content/70"}`}
                />
              </LinkComponent>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
