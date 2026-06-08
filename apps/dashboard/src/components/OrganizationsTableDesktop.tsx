"use client";

import {
  OrgUserSummary,
  OrganizationSummary,
  OrganizationsTableDesktopProps,
  TableColumn,
  TableOrgWithScore,
} from "@/types";
import React from "react";
import { Table } from "@/components/ui/Table";
import {
  Building2,
  User,
  Mail,
  Eye,
  Edit3,
  Users,
  ShieldAlert,
  Zap,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { getScoreBadgeColor } from "@/utils/client";

export function OrganizationsTableDesktop({
  organizations,
  onEdit,
  onManageUsers,
  onActivate,
}: OrganizationsTableDesktopProps) {
  const columns: TableColumn<TableOrgWithScore>[] = [
    {
      key: "name",
      header: "Organización",
      className: "font-bold text-base-content",
      render: (org) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Building2 className="size-5" />
          </div>
          <span className="font-bold text-sm text-base-content">
            {org.name}
          </span>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Propietario",
      render: (org) => {
        const owner =
          org.ownerUser ||
          org.users?.find((u) => u.role === "OWNER") ||
          org.users?.[0];
        return owner ? (
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-xs text-base-content/90">
              <User className="size-3.5 text-base-content/40" />
              <span>{owner.name}</span>
              <span className="badge badge-success badge-xs text-white text-[8px] px-1 py-0.5">
                Owner
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-base-content/50 mt-0.5">
              <Mail className="size-3" />
              <span>{owner.email}</span>
            </div>
          </div>
        ) : (
          <span className="text-warning italic text-xs flex items-center gap-1.5">
            <ShieldAlert className="size-3.5" />
            Sin propietario asignado
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      className: "font-semibold text-xs",
      render: (org) => {
        const isActive = org.subscriptionStatus === "ACTIVE";
        const isPending = org.subscriptionStatus === "PENDING_ACTIVATION";
        let badgeClass =
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
        let statusText = "Inactivo";

        if (isActive) {
          badgeClass =
            "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
          statusText = "Activo";
        } else if (isPending) {
          badgeClass =
            "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
          statusText = "Pendiente";
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span className={`badge badge-sm font-bold border ${badgeClass}`}>
              {statusText}
            </span>
            {isActive && org.subscriptionExpiresAt && (
              <span className="text-[10px] text-base-content/40 font-medium whitespace-nowrap">
                Expira:{" "}
                {new Date(org.subscriptionExpiresAt).toLocaleDateString(
                  "es-ES",
                )}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "vehicles",
      header: "Vehículos",
      headerClassName: "text-center",
      className: "text-center font-bold text-xs",
      render: (org) => (
        <span className="badge badge-neutral font-semibold text-xs py-1 px-2.5">
          {org._count.vehicles}{" "}
          {org._count.vehicles === 1 ? "Vehículo" : "Vehículos"}
        </span>
      ),
    },
    {
      key: "avgSafety",
      header: "Puntaje Promedio",
      headerClassName: "text-center",
      className: "text-center",
      render: (org) => {
        return org.avgSafety !== null ? (
          <span
            className={`badge text-[10px] font-extrabold px-2.5 py-1 ${getScoreBadgeColor(org.avgSafety)}`}
          >
            {org.avgSafety} pts
          </span>
        ) : (
          <span className="text-base-content/40 italic text-xs">Sin datos</span>
        );
      },
    },
    {
      key: "actions",
      header: "Acciones",
      headerClassName: "text-right",
      className: "text-right",
      render: (org) => (
        <div className="flex items-center justify-end gap-1.5">
          {org.paymentReceiptUrl && (
            <a
              href={org.paymentReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-xs btn-info text-white hover:brightness-110 font-bold flex items-center justify-center gap-1 shadow-sm"
              title="Ver Comprobante de Pago"
            >
              <FileText className="size-3" />
              Recibo
            </a>
          )}
          {org.subscriptionStatus !== "ACTIVE" && (
            <button
              type="button"
              onClick={() => onActivate(org)}
              className="btn btn-xs btn-success text-white hover:brightness-110 font-bold flex items-center justify-center gap-1 shadow-sm"
              title="Activar Suscripción Directamente"
            >
              <Zap className="size-3" />
              Activar
            </button>
          )}
          <Link
            href={`/admin?targetOrgId=${org.id}`}
            className="btn btn-xs btn-outline btn-primary font-bold flex items-center justify-center gap-1"
            title="Ver como Owner"
          >
            <Eye className="size-3" />
            Ver como Owner
          </Link>
          <button
            type="button"
            onClick={() => onEdit(org)}
            className="btn btn-xs btn-outline border-base-300 hover:bg-base-200 text-base-content font-semibold"
            title="Editar Organización"
          >
            <Edit3 className="size-3" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => onManageUsers(org)}
            className="btn btn-xs btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 font-semibold"
            title="Gestionar Usuarios"
          >
            <Users className="size-3" />
            Usuarios
          </button>
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={organizations}
      keyExtractor={(org) => org.id}
      className="table table-md w-full"
      pagination={true}
      pageSize={10}
      emptyState={
        <div className="p-6 text-center text-sm text-base-content/60">
          No hay organizaciones registradas en el sistema.
        </div>
      }
    />
  );
}
