'use client';

import { FleetUserSummary, TableColumn, UsersTableDesktopProps } from '@/types';
import React from 'react';
import { Table } from '@/components/ui/Table';
import { Shield, Mail, UserCheck, UserX, Calendar } from 'lucide-react';
import { ROLES } from '@/utils/enums';

export function UsersTableDesktop({ users, actorRole, onLink, onUnlink }: UsersTableDesktopProps) {
  const columns: TableColumn<FleetUserSummary>[] = [
    {
      key: 'name',
      header: 'Nombre',
      className: 'font-bold text-base-content',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-9 h-9 flex items-center justify-center font-bold text-xs">
              {u.name ? u.name.substring(0, 2).toUpperCase() : 'US'}
            </div>
          </div>
          <div>
            <div className="font-bold text-sm text-base-content">{u.name}</div>
            <div className="text-[10px] text-base-content/50 flex items-center gap-1 mt-0.5">
              <Mail className="size-3" />
              {u.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (u) => (
        <span className={`badge badge-sm font-semibold text-[10px] text-white py-1 px-2 ${
          u.role === 'OWNER' ? 'badge-primary' : 'badge-secondary'
        }`}>
          {u.role === 'OWNER' ? 'Propietario (Owner)' : 'Administrador (Admin)'}
        </span>
      ),
    },
    {
      key: 'driverLink',
      header: 'Vínculo Conductor',
      render: (u) => {
        const hasDriverLink = !!u.driver;
        return hasDriverLink && u.driver ? (
          <div className="space-y-1">
            <span className="badge badge-success badge-xs font-semibold text-white py-1 px-1.5 flex items-center gap-1 w-fit text-[9px]">
              <UserCheck className="size-2.5" />
              Vínculo Activo
            </span>
            <div className="text-[10px] text-base-content/60 font-mono mt-0.5">
              ID: {u.driver.nationalId} {u.driver.phone ? `| Tel: ${u.driver.phone}` : ''}
            </div>
          </div>
        ) : (
          <span className="badge badge-ghost badge-xs font-semibold text-base-content/40 py-1 px-1.5 flex items-center gap-1 w-fit text-[9px]">
            <UserX className="size-2.5" />
            No Vinculado
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Registro',
      className: 'text-xs text-base-content/60 font-medium',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 text-base-content/30" />
          <span>
            {new Date(u.createdAt).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (u) => {
        const hasDriverLink = !!u.driver;
        const canManage = (actorRole === ROLES.SUPER_ADMIN && u.role !== ROLES.SUPER_ADMIN) ||
                          (actorRole === ROLES.OWNER && u.role === ROLES.ADMIN);

        if (!canManage) return <span className="text-base-content/30 text-xs italic">Solo lectura</span>;

        return hasDriverLink ? (
          <button
            type="button"
            onClick={() => onUnlink(u.id)}
            className="btn btn-outline btn-error btn-xs rounded-lg px-2.5 h-[32px] inline-flex items-center cursor-pointer"
            title="Desvincular Conductor"
          >
            Desvincular
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onLink(u)}
            className="btn btn-primary btn-xs rounded-lg px-2.5 h-[32px] inline-flex items-center cursor-pointer"
            title="Vincular Conductor"
          >
            Vincular
          </button>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      data={users}
      keyExtractor={(u) => u.id}
      className="table table-md w-full"
      pagination={true}
      pageSize={10}
      emptyState={
        <div className="p-6 text-center text-sm text-base-content/60">
          No hay administradores registrados para esta flota.
        </div>
      }
    />
  );
}
