"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import { useEffect, useState } from "react";
import api from "@/utils/client/api-client";
import Link from "next/link";
import { Eye, X } from "lucide-react";

export function ImpersonationBanner() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const { role } = useAuth();
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (role === ROLES.SUPER_ADMIN && targetOrgId) {
      api
        .get("/organizations")
        .then(({ data }) => {
          const org = data.find(
            (o: { id: string; name: string }) => o.id === targetOrgId,
          );
          if (org) setOrgName(org.name);
        })
        .catch((err) => {
          console.error(
            "Error al obtener organizaciones para el banner de impersonación:",
            err,
          );
        });
    }
  }, [role, targetOrgId]);

  if (role !== ROLES.SUPER_ADMIN || !targetOrgId) return null;

  const displayName = orgName || targetOrgId;

  return (
    <div className="flex items-center gap-3 px-4 lg:px-5 h-8 lg:h-9 shrink-0 border-l-2 border-amber-500 bg-amber-500/8 text-amber-800 dark:text-amber-300">
      <Eye className="size-3.5 shrink-0 opacity-70" />
      <span className="text-xs font-medium flex-1 truncate">
        Vista de: <strong className="font-bold">{displayName}</strong>
        <span className="text-amber-700/60 dark:text-amber-400/60 font-normal ml-1 hidden lg:inline">
          · Super Admin
        </span>
      </span>
      <Link
        href="/organizations"
        className="btn btn-ghost btn-circle btn-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 shrink-0"
        title="Salir de la vista"
      >
        <X className="size-3.5" />
      </Link>
    </div>
  );
}
