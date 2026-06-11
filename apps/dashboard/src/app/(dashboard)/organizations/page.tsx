"use client";

import {
  OrganizationsPageInvitation,
  OrganizationsPageOrg,
  TableColumn,
  TableOrgWithScore,
} from "@/types";
import { useState, useEffect, useRef } from "react";
import api from "@/utils/client/api-client";
import { formatDate, getOrgSubscriptionBadgeClass } from "@/utils/client";
import Link from "next/link";
import {
  Building2,
  User,
  Mail,
  ShieldAlert,
  Plus,
  Loader2,
  Edit3,
  Users,
  Trash2,
  X,
  Eye,
  EyeOff,
  Link2,
  Copy,
  Check,
  Zap,
  FileText,
  Settings,
  DollarSign,
} from "lucide-react";
import { MobileDrawer } from "@/components/MobileDrawer";
import { Table } from "@/components/ui/Table";
import { OrganizationsTableDesktop } from "@/components/OrganizationsTableDesktop";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationsPageOrg[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationsPageOrg | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Form states (OrganizationsPageOrg)
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [subStatus, setSubStatus] = useState<string>("INACTIVE");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);

  // User Management State
  const [activeOrgForUsers, setActiveOrgForUsers] =
    useState<OrganizationsPageOrg | null>(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<
    OrganizationsPageOrg["users"][number] | null
  >(null);
  const [userFormName, setUserFormName] = useState("");
  const [userFormEmail, setUserFormEmail] = useState("");
  const [userFormPassword, setUserFormPassword] = useState("");
  const [userFormRole, setUserFormRole] = useState<"OWNER" | "ADMIN">("ADMIN");
  const [showUserFormPassword, setShowUserFormPassword] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);

  // Tab & OrganizationsPageInvitation States
  const [activeTab, setActiveTab] = useState<
    "orgs" | "invitations" | "settings"
  >("orgs");
  const [invitations, setInvitations] = useState<OrganizationsPageInvitation[]>(
    [],
  );
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [isGeneratingInvitation, setIsGeneratingInvitation] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form states for settings
  const [flatSaaSPrice, setFlatSaaSPrice] = useState<number>(49);
  const [geolocationPrice, setGeolocationPrice] = useState<number>(15);
  const [diagnosticsPrice, setDiagnosticsPrice] = useState<number>(30);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Refs de control para evitar peticiones API duplicadas al cambiar de pestaña
  const lastFetchedSettingsRef = useRef(false);
  const lastFetchedInvitationsRef = useRef(false);

  const fetchSettings = async () => {
    try {
      setIsLoadingSettings(true);
      setSettingsError(null);
      const { data } = await api.get("/billing/settings");
      setFlatSaaSPrice(data.flatSaaSPrice);
      setGeolocationPrice(data.geolocationPrice);
      setDiagnosticsPrice(data.diagnosticsPrice);
    } catch (err) {
      console.error(err);
      setSettingsError("Error al cargar la configuración de precios.");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === "settings" && !lastFetchedSettingsRef.current) {
      fetchSettings();
      lastFetchedSettingsRef.current = true;
    }
  }, [activeTab]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);

    if (flatSaaSPrice < 0 || geolocationPrice < 0 || diagnosticsPrice < 0) {
      setSettingsError("Los precios no pueden ser negativos.");
      setIsLoadingSettings(false);
      return;
    }

    try {
      await api.patch("/billing/settings", {
        flatSaaSPrice,
        geolocationPrice,
        diagnosticsPrice,
      });
      setSettingsSuccess("Configuración de precios actualizada con éxito.");
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setSettingsError(
        message || "Error al guardar la configuración de precios.",
      );
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleDirectActivate = async (org: OrganizationsPageOrg) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas activar la organización "${org.name}" directamente por 1 año?`,
      )
    ) {
      return;
    }
    try {
      setIsLoading(true);
      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() + 1); // 1 año desde hoy

      await api.post("/billing/admin/activate", {
        orgId: org.id,
        expiresAt: targetDate.toISOString(),
      });

      // Refrescar lista
      await fetchOrganizations();
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      alert(message || "Error al activar la organización");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchInvitations = async () => {
    try {
      setIsLoadingInvitations(true);
      setInvitationsError(null);
      const { data } = await api.get("/invitations");
      setInvitations(data);
    } catch (err) {
      console.error(err);
      setInvitationsError("Error al cargar enlaces de invitación");
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const handleGenerateInvitation = async () => {
    try {
      setIsGeneratingInvitation(true);
      setInvitationsError(null);
      await api.post("/invitations");
      await fetchInvitations();
    } catch (err) {
      console.error(err);
      setInvitationsError("Error al generar enlace de invitación");
    } finally {
      setIsGeneratingInvitation(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const registerUrl = `${window.location.origin}/register/owner?token=${token}`;
    navigator.clipboard.writeText(registerUrl);
    setCopiedToken(token);
    setTimeout(() => {
      setCopiedToken(null);
    }, 2000);
  };

  useEffect(() => {
    if (activeTab === "invitations" && !lastFetchedInvitationsRef.current) {
      fetchInvitations();
      lastFetchedInvitationsRef.current = true;
    }
  }, [activeTab]);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get("/organizations");
      setOrganizations(data);
      return data;
    } catch (err) {
      console.error(err);
      setError("Error al cargar organizaciones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const openCreateModal = () => {
    setEditingOrg(null);
    setName("");
    setOwnerName("");
    setOwnerEmail("");
    setOwnerPassword("");
    setSubStatus("INACTIVE");
    setExpiresAt("");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (org: OrganizationsPageOrg) => {
    setEditingOrg(org);
    setName(org.name);
    setSubStatus(org.subscriptionStatus || "INACTIVE");
    if (org.subscriptionExpiresAt) {
      setExpiresAt(
        new Date(org.subscriptionExpiresAt).toISOString().split("T")[0],
      );
    } else {
      setExpiresAt("");
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (editingOrg) {
        // Modo Edición: nombre, status y expiración
        await api.patch(`/organizations/${editingOrg.id}`, {
          name,
          subscriptionStatus: subStatus,
          subscriptionExpiresAt:
            subStatus === "ACTIVE" && expiresAt
              ? new Date(expiresAt).toISOString()
              : null,
        });
      } else {
        // Modo Creación
        await api.post("/organizations", {
          name,
          ownerName,
          ownerEmail,
          ownerPassword: ownerPassword || undefined,
        });
      }

      // Cerrar y resetear
      setIsModalOpen(false);
      setName("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPassword("");
      setEditingOrg(null);

      // Refresh list
      fetchOrganizations();
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(message || "Error al guardar la organización");
    } finally {
      setIsSubmitting(false);
    }
  };

  // User Management functions
  const refreshOrgUsers = async (orgId: string) => {
    try {
      const data = await fetchOrganizations();
      if (data) {
        const updatedOrg = data.find(
          (o: OrganizationsPageOrg) => o.id === orgId,
        );
        if (updatedOrg) {
          setActiveOrgForUsers(updatedOrg);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Error al refrescar los usuarios");
    }
  };

  const handleOpenUserForm = (user?: OrganizationsPageOrg["users"][number]) => {
    if (user) {
      setEditingUser(user);
      setUserFormName(user.name || "");
      setUserFormEmail(user.email);
      setUserFormPassword("");
      setUserFormRole(user.role);
    } else {
      setEditingUser(null);
      setUserFormName("");
      setUserFormEmail("");
      setUserFormPassword("");
      setUserFormRole("ADMIN");
    }
    setUserFormError(null);
    setUserFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgForUsers) return;
    setUserFormError(null);
    setUserFormSubmitting(true);

    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          name: userFormName,
          email: userFormEmail,
          role: userFormRole,
          password: userFormPassword || undefined,
        });
      } else {
        await api.post("/users", {
          name: userFormName,
          email: userFormEmail,
          password: userFormPassword,
          role: userFormRole,
          orgId: activeOrgForUsers.id,
        });
      }

      setUserFormOpen(false);
      setEditingUser(null);
      setUserFormName("");
      setUserFormEmail("");
      setUserFormPassword("");
      setUserFormRole("ADMIN");
      await refreshOrgUsers(activeOrgForUsers.id);
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setUserFormError(message || "Error al guardar el usuario");
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!activeOrgForUsers) return;
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return;

    try {
      await api.delete(`/users/${userId}`);
      await refreshOrgUsers(activeOrgForUsers.id);
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      alert(message || "Error al eliminar el usuario");
    }
  };

  const renderUserForm = () => {
    return (
      <form onSubmit={handleSaveUser} className="space-y-4">
        <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
          {editingUser ? (
            <Edit3 className="size-5 text-primary" />
          ) : (
            <Plus className="size-5 text-primary" />
          )}
          {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
        </h3>
        <p className="text-xs text-base-content/60">
          {editingUser
            ? "Modifica los accesos y credenciales del usuario."
            : "Crea un nuevo usuario (Owner o Admin) para esta organización."}
        </p>

        {userFormError && (
          <div className="alert alert-error text-xs p-3 shadow">
            <ShieldAlert className="size-4 shrink-0 text-white" />
            <span>{userFormError}</span>
          </div>
        )}

        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-bold text-xs text-base-content/85">
              Nombre Completo
            </span>
          </label>
          <input
            type="text"
            required
            value={userFormName}
            onChange={(e) => setUserFormName(e.target.value)}
            placeholder="Ej. Juan Pérez"
            className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            disabled={userFormSubmitting}
          />
        </div>

        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-bold text-xs text-base-content/85">
              Correo Electrónico
            </span>
          </label>
          <input
            type="email"
            required
            value={userFormEmail}
            onChange={(e) => setUserFormEmail(e.target.value)}
            placeholder="juan@correo.com"
            className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            disabled={userFormSubmitting}
          />
        </div>

        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-bold text-xs text-base-content/85">
              Contraseña{" "}
              {editingUser
                ? "(Dejar en blanco para no cambiar)"
                : "(Mínimo 6 caracteres)"}
            </span>
          </label>
          <div className="relative">
            <input
              type={showUserFormPassword ? "text" : "password"}
              required={!editingUser}
              value={userFormPassword}
              onChange={(e) => setUserFormPassword(e.target.value)}
              placeholder={
                editingUser ? "••••••" : "Dejar vacío para usar Temporal123!"
              }
              className="input input-bordered w-full pr-10 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              disabled={userFormSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowUserFormPassword(!showUserFormPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/40 hover:text-base-content/70 cursor-pointer"
              title={
                showUserFormPassword
                  ? "Ocultar contraseña"
                  : "Mostrar contraseña"
              }
            >
              {showUserFormPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-bold text-xs text-base-content/85">
              Rol
            </span>
          </label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="userFormRole"
                value="ADMIN"
                checked={userFormRole === "ADMIN"}
                onChange={() => setUserFormRole("ADMIN")}
                className="radio radio-primary"
                disabled={userFormSubmitting}
              />
              <span className="text-sm text-base-content">
                Administrador (ADMIN)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="userFormRole"
                value="OWNER"
                checked={userFormRole === "OWNER"}
                onChange={() => setUserFormRole("OWNER")}
                className="radio radio-primary"
                disabled={userFormSubmitting}
              />
              <span className="text-sm text-base-content">
                Propietario (OWNER)
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-base-200">
          <button
            type="button"
            onClick={() => setUserFormOpen(false)}
            className="btn btn-ghost"
            disabled={userFormSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white font-semibold"
            disabled={userFormSubmitting}
          >
            {userFormSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Usuario"
            )}
          </button>
        </div>
      </form>
    );
  };

  const renderUserList = (org: OrganizationsPageOrg) => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-base-200">
          <div>
            <h3 className="font-bold text-lg text-base-content">
              Usuarios Activos
            </h3>
            <p className="text-xs text-base-content/50">
              Gestiona los propietarios y administradores de la organización.
            </p>
          </div>
          <button
            onClick={() => handleOpenUserForm()}
            className="btn btn-primary btn-sm bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow hover:brightness-110 font-semibold"
          >
            <Plus className="size-4" />
            Nuevo Usuario
          </button>
        </div>

        {org.users && org.users.length > 0 ? (
          <div className="divide-y divide-base-200 max-h-[40vh] overflow-y-auto pr-1">
            {org.users.map((u) => (
              <div
                key={u.id}
                className="flex justify-between items-center py-3 group/user"
              >
                <div className="flex items-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                      {u.name ? u.name.substring(0, 2).toUpperCase() : "US"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-base-content flex items-center gap-2">
                      {u.name || "Sin Nombre"}
                      <span
                        className={`badge badge-sm text-[10px] text-white font-bold py-1 px-1.5 ${u.role === "OWNER"
                            ? "bg-emerald-600 border-emerald-600"
                            : "bg-slate-500 border-slate-500"
                          }`}
                      >
                        {u.role}
                      </span>
                    </div>
                    <div className="text-xs text-base-content/60 flex items-center gap-1 mt-0.5">
                      <Mail className="size-3" />
                      {u.email}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenUserForm(u)}
                    className="btn btn-square btn-ghost btn-sm text-base-content/60 hover:text-primary transition-colors"
                    title="Editar usuario"
                  >
                    <Edit3 className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="btn btn-square btn-ghost btn-sm text-base-content/60 hover:text-error transition-colors"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-base-100/30 rounded-xl border border-dashed border-base-300">
            <Users className="size-10 text-base-content/20 mb-2" />
            <h4 className="text-sm font-semibold">Sin usuarios asignados</h4>
            <p className="text-xs text-base-content/50 max-w-[200px] mt-0.5">
              Crea un usuario para dar acceso a esta flota.
            </p>
          </div>
        )}
      </div>
    );
  };

  const invitationColumns: TableColumn<OrganizationsPageInvitation>[] = [
    {
      key: "token",
      header: "Enlace de Invitación",
      className:
        "py-4 px-6 font-medium text-sm text-base-content max-w-xs md:max-w-md",
      headerClassName: "py-4 px-6 font-bold text-xs uppercase tracking-wider",
      render: (inv) => {
        const registerUrl = `${window.location.origin}/register/owner?token=${inv.token}`;
        return (
          <div className="flex items-center gap-2">
            <span className="truncate bg-base-200/60 text-base-content/95 font-mono text-xs px-2.5 py-1.5 rounded-lg border border-base-300/80">
              {registerUrl}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      className: "py-4 px-6",
      headerClassName: "py-4 px-6 font-bold text-xs uppercase tracking-wider",
      render: (inv) => {
        const isUsed = !!inv.usedAt;
        const isExpired = !isUsed && new Date(inv.expiresAt) < new Date();
        if (isUsed) {
          return (
            <Badge variant="success" size="sm">
              Utilizado
            </Badge>
          );
        }
        if (isExpired) {
          return (
            <Badge variant="error" size="sm">
              Expirado
            </Badge>
          );
        }
        return (
          <Badge variant="info" size="sm">
            Activo
          </Badge>
        );
      },
    },
    {
      key: "createdAt",
      header: "Creado El",
      className: "py-4 px-6 text-xs text-base-content/70 font-medium",
      headerClassName: "py-4 px-6 font-bold text-xs uppercase tracking-wider",
      render: (inv) => formatDate(inv.createdAt),
    },
    {
      key: "expiresAt",
      header: "Vence El",
      className: "py-4 px-6 text-xs text-base-content/70 font-medium",
      headerClassName: "py-4 px-6 font-bold text-xs uppercase tracking-wider",
      render: (inv) => formatDate(inv.expiresAt),
    },
    {
      key: "actions",
      header: "Acciones",
      className: "py-4 px-6 text-right",
      headerClassName:
        "py-4 px-6 font-bold text-xs uppercase tracking-wider text-right",
      render: (inv) => {
        const isCopied = copiedToken === inv.token;
        const isUsed = !!inv.usedAt;
        const isExpired = !isUsed && new Date(inv.expiresAt) < new Date();
        return (
          <button
            onClick={() => handleCopyLink(inv.token)}
            disabled={isUsed || isExpired}
            className={`btn btn-sm ${isCopied
                ? "btn-success text-white"
                : "btn-outline border-base-300 text-base-content hover:bg-base-200"
              } font-semibold transition-all duration-200 rounded-xl`}
            title={isCopied ? "¡Copiado!" : "Copiar enlace"}
          >
            {isCopied ? (
              <>
                <Check className="size-4 mr-1.5 animate-in zoom-in" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-4 mr-1.5" />
                Copiar
              </>
            )}
          </button>
        );
      },
    },
  ];

  const orgsWithScores: TableOrgWithScore[] = organizations.map((org) => {
    const ownerUser =
      org.users?.find((u) => u.role === "OWNER") || org.users?.[0] || null;
    return {
      ...org,
      avgSafety: null,
      ownerUser,
    };
  });

  const showGrouping = organizations.length > 5;
  const groupedOrgs: Record<string, OrganizationsPageOrg[]> = {};
  organizations.forEach((org) => {
    const firstLetter = org.name ? org.name.substring(0, 1).toUpperCase() : "?";
    if (!groupedOrgs[firstLetter]) {
      groupedOrgs[firstLetter] = [];
    }
    groupedOrgs[firstLetter].push(org);
  });

  const alphabetKeys = Object.keys(groupedOrgs).sort();
  const firstAlphabetKey = alphabetKeys[0] || "";

  const renderOrgCard = (org: OrganizationsPageOrg) => {
    const owner = org.users?.find((u) => u.role === "OWNER") || org.users?.[0];
    const adminsCount =
      org.users?.filter((u) => u.role === "ADMIN").length || 0;

    const expiresAtDate = org.subscriptionExpiresAt;
    const isExpired = expiresAtDate
      ? new Date(expiresAtDate) < new Date()
      : true;
    const badgeClass = getOrgSubscriptionBadgeClass(
      org.subscriptionStatus,
      isExpired,
    );
    const isActive = org.subscriptionStatus === "ACTIVE" && !isExpired;
    const statusText = isActive
      ? "Activo"
      : org.subscriptionStatus === "PENDING_ACTIVATION"
        ? "Pendiente"
        : "Inactivo";

    return (
      <div
        key={org.id}
        className="card bg-base-100/60 backdrop-blur-sm border border-base-200 shadow-md hover:shadow-md hover:border-primary/30 transition-all duration-300 group relative flex flex-col justify-between text-left animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="card-body p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-all duration-300">
                <Building2 className="text-primary size-6" />
              </div>
              <div className="flex gap-2 items-center">
                <span
                  className={`badge badge-sm font-bold border ${badgeClass}`}
                >
                  {statusText}
                </span>
                <span className="badge badge-neutral font-semibold text-xs py-2 px-2.5">
                  {org._count.vehicles}{" "}
                  {org._count.vehicles === 1 ? "Vehículo" : "Vehículos"}
                </span>
              </div>
            </div>

            <div>
              <h2 className="card-title text-xl font-bold tracking-tight text-base-content">
                {org.name}
              </h2>
              {isActive && org.subscriptionExpiresAt && (
                <p className="text-[10px] text-base-content/50 font-semibold mt-1">
                  Expira:{" "}
                  {new Date(org.subscriptionExpiresAt).toLocaleDateString(
                    "es-ES",
                  )}
                </p>
              )}
              <div className="divider my-2 opacity-40"></div>
            </div>

            {owner ? (
              <div className="space-y-2.5 text-sm text-base-content/75">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-base-content/40" />
                  <span className="font-semibold text-base-content/90">
                    {owner.name}
                  </span>
                  <span className="badge badge-success badge-sm text-[10px] text-white font-bold">
                    Owner
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-base-content/40" />
                  <span className="truncate text-base-content/60">
                    {owner.email}
                  </span>
                </div>
                {adminsCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-base-content/50 font-medium">
                    <Users className="size-4 text-slate-500" />
                    <span>
                      {adminsCount}{" "}
                      {adminsCount === 1 ? "Administrador" : "Administradores"}{" "}
                      adicional(es)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-warning italic flex items-center gap-2">
                <ShieldAlert className="size-4" />
                Sin propietario asignado
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-base-200 space-y-2">
            {org.paymentReceiptUrl && (
              <a
                href={org.paymentReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-info text-white w-full font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <FileText className="size-4" />
                Ver Comprobante
              </a>
            )}
            {!isActive && (
              <button
                onClick={() => handleDirectActivate(org)}
                className="btn btn-sm btn-success text-white w-full font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Zap className="size-4" />
                Activar Directamente
              </button>
            )}
            <Link
              href={`/admin?targetOrgId=${org.id}`}
              className="btn btn-sm btn-outline btn-primary w-full font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <Eye className="size-4" />
              Ver como Owner
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => openEditModal(org)}
                className="btn btn-sm btn-outline flex-1 border-base-300 hover:bg-base-200 text-base-content font-semibold"
              >
                <Edit3 className="size-4" />
                Editar
              </button>
              <button
                onClick={() => {
                  setActiveOrgForUsers(org);
                  setUserFormOpen(false);
                }}
                className="btn btn-sm btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 flex-1 font-semibold"
              >
                <Users className="size-4" />
                Usuarios
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 text-base-content">
            <Building2 className="text-primary size-7" />
            Control de Organizaciones
          </h1>
          <p className="text-base-content/65 text-sm mt-1">
            {activeTab === "orgs" &&
              "Administra las flotas asociadas a la plataforma y asigna sus respectivos propietarios."}
            {activeTab === "invitations" &&
              "Genera y administra enlaces únicos para que nuevos propietarios completen su onboarding."}
            {activeTab === "settings" &&
              "Modifica los precios y tarifas de los distintos planes y servicios del CRM."}
          </p>
        </div>

        {activeTab === "orgs" && (
          <button
            onClick={openCreateModal}
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 shadow-lg shadow-blue-500/20 active:scale-95 transition-all duration-200"
          >
            <Plus className="size-5" />
            Nueva Organización
          </button>
        )}

        {activeTab === "invitations" && (
          <button
            onClick={handleGenerateInvitation}
            disabled={isGeneratingInvitation}
            className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 shadow-lg shadow-blue-500/20 active:scale-95 transition-all duration-200"
          >
            {isGeneratingInvitation ? (
              <>
                <Loader2 className="size-5 animate-spin mr-2" />
                Generando...
              </>
            ) : (
              <>
                <Plus className="size-5" />
                Generar Enlace
              </>
            )}
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-base-100/40 border border-base-200/60 backdrop-blur-md p-1 rounded-2xl max-w-md shadow-inner gap-1">
        <button
          onClick={() => setActiveTab("orgs")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl font-bold text-xs py-3 px-3 transition-all duration-300 ${activeTab === "orgs"
              ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
              : "text-base-content/60 hover:text-base-content hover:bg-base-200/50"
            }`}
        >
          <Building2 className="size-4" />
          Organizaciones
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl font-bold text-xs py-3 px-3 transition-all duration-300 ${activeTab === "invitations"
              ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
              : "text-base-content/60 hover:text-base-content hover:bg-base-200/50"
            }`}
        >
          <Link2 className="size-4" />
          Invitaciones
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl font-bold text-xs py-3 px-3 transition-all duration-300 ${activeTab === "settings"
              ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
              : "text-base-content/60 hover:text-base-content hover:bg-base-200/50"
            }`}
        >
          <Settings className="size-4" />
          Precios
        </button>
      </div>

      {activeTab === "orgs" && (
        <>
          {error && !isModalOpen && (
            <div className="alert alert-error shadow-lg">
              <ShieldAlert className="size-6 text-white shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Grid/List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-base-content/60 text-sm">
                Cargando organizaciones...
              </p>
            </div>
          ) : organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20">
              <Building2 className="size-16 text-base-content/20 mb-4" />
              <h3 className="text-lg font-bold">
                No hay organizaciones creadas
              </h3>
              <p className="text-base-content/50 text-sm max-w-sm mt-1">
                Comienza registrando la primera organización de flota y
                asignando su administrador principal.
              </p>
              <button
                onClick={openCreateModal}
                className="btn btn-primary btn-outline mt-6"
              >
                Crear Primera Organización
              </button>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block">
                <OrganizationsTableDesktop
                  organizations={orgsWithScores}
                  onEdit={openEditModal}
                  onManageUsers={(org) => {
                    setActiveOrgForUsers(org);
                    setUserFormOpen(false);
                  }}
                  onActivate={handleDirectActivate}
                />
              </div>

              {/* Mobile View */}
              <div className="block lg:hidden">
                {showGrouping ? (
                  <div className="space-y-4">
                    {alphabetKeys.map((char) => (
                      <div
                        key={char}
                        className="collapse collapse-arrow bg-base-100/40 border border-base-200 shadow-md rounded-2xl overflow-hidden backdrop-blur-md"
                      >
                        <input
                          type="checkbox"
                          defaultChecked={char === firstAlphabetKey}
                          className="peer"
                          aria-label={`Mostrar flotas con letra ${char}`}
                        />
                        <div className="collapse-title text-sm font-bold flex items-center gap-2 pr-10 text-base-content bg-base-200/20">
                          <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                            {char}
                          </span>
                          <span>Flotas ({char})</span>
                          <span className="badge badge-neutral badge-sm ml-2 font-mono font-bold bg-base-300 border-none text-base-content/85">
                            {groupedOrgs[char].length}
                          </span>
                        </div>
                        <div className="collapse-content p-4 bg-base-100/10 space-y-4">
                          {groupedOrgs[char].map(renderOrgCard)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {organizations.map(renderOrgCard)}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "invitations" && (
        <>
          {invitationsError && (
            <div className="alert alert-error shadow-lg">
              <ShieldAlert className="size-6 text-white shrink-0" />
              <span>{invitationsError}</span>
            </div>
          )}

          {isLoadingInvitations ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-base-content/60 text-sm">
                Cargando enlaces de invitación...
              </p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20">
              <Link2 className="size-16 text-base-content/20 mb-4" />
              <h3 className="text-lg font-bold">
                No hay enlaces de invitación
              </h3>
              <p className="text-base-content/50 text-sm max-w-sm mt-1">
                Genera el primer enlace de invitación para permitir que un nuevo
                propietario de flota se registre de manera autónoma.
              </p>
              <button
                onClick={handleGenerateInvitation}
                disabled={isGeneratingInvitation}
                className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white hover:brightness-110 shadow-lg mt-6"
              >
                {isGeneratingInvitation ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Plus className="size-4 mr-2" />
                    Generar Primer Enlace
                  </>
                )}
              </button>
            </div>
          ) : (
            <Table
              columns={invitationColumns}
              data={invitations}
              keyExtractor={(inv) => inv.id}
              className="table w-full text-left"
              wrapperClassName="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-200 overflow-hidden shadow-md overflow-x-auto w-full"
              tbodyClassName="divide-y divide-base-200/40"
              rowClassName="hover:bg-base-200/20 transition-colors"
              pagination={true}
              pageSize={10}
            />
          )}
        </>
      )}

      {activeTab === "settings" && (
        <div className="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-200 overflow-hidden shadow-md p-8 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-base-200">
            <div className="p-3 bg-primary/10 rounded-xl">
              <DollarSign className="text-primary size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-base-content">
                Configuración de Precios de Suscripción
              </h2>
              <p className="text-xs text-base-content/60">
                Define los precios estándar en USD. Se aplicarán dinámicamente a
                todas las organizaciones al momento de pagar.
              </p>
            </div>
          </div>

          {isLoadingSettings && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-base-content/60 text-sm">
                Cargando tarifas...
              </p>
            </div>
          )}

          {!isLoadingSettings && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {settingsSuccess && (
                <div className="alert alert-success shadow-sm text-xs p-3">
                  <Check className="size-4 text-white shrink-0" />
                  <span className="text-white font-semibold">
                    {settingsSuccess}
                  </span>
                </div>
              )}

              {settingsError && (
                <div className="alert alert-error shadow-sm text-xs p-3">
                  <ShieldAlert className="size-4 text-white shrink-0" />
                  <span className="text-white font-semibold">
                    {settingsError}
                  </span>
                </div>
              )}

              {/* Tier 1: Flat SaaS */}
              <div className="form-control gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <label className="label-text font-bold text-sm text-base-content">
                      SaaS Base Mensual (Tier 1)
                    </label>
                    <p className="text-xs text-base-content/50">
                      Cobro mensual fijo si la organización NO tiene vehículos
                      con servicios de pago activos.
                    </p>
                  </div>
                </div>
                <div className="relative max-w-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/50 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={flatSaaSPrice}
                    onChange={(e) =>
                      setFlatSaaSPrice(parseFloat(e.target.value) || 0)
                    }
                    className="input input-bordered w-full pl-8 font-semibold focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Tier 2: Geolocation */}
              <div className="form-control gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <label className="label-text font-bold text-sm text-base-content">
                      Geolocalización por Vehículo (Tier 2)
                    </label>
                    <p className="text-xs text-base-content/50">
                      Precio mensual adicional por cada vehículo configurado con
                      rastreo básico.
                    </p>
                  </div>
                </div>
                <div className="relative max-w-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/50 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={geolocationPrice}
                    onChange={(e) =>
                      setGeolocationPrice(parseFloat(e.target.value) || 0)
                    }
                    className="input input-bordered w-full pl-8 font-semibold focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Tier 3: Diagnostics */}
              <div className="form-control gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <label className="label-text font-bold text-sm text-base-content">
                      Diagnóstico y Telemetría por Vehículo (Tier 3)
                    </label>
                    <p className="text-xs text-base-content/50">
                      Precio mensual adicional por cada vehículo configurado con
                      telemetría avanzada y diagnósticos OBD-II.
                    </p>
                  </div>
                </div>
                <div className="relative max-w-xs">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base-content/50 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={diagnosticsPrice}
                    onChange={(e) =>
                      setDiagnosticsPrice(parseFloat(e.target.value) || 0)
                    }
                    className="input input-bordered w-full pl-8 font-semibold focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-base-200">
                <button
                  type="submit"
                  disabled={isLoadingSettings}
                  className="btn btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 border-none text-white shadow-lg font-bold px-8 hover:brightness-110 active:scale-95 transition-all duration-200"
                >
                  Guardar Precios
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Creation/Edit Org Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Building2 className="text-primary size-6" />
            {editingOrg ? "Editar Organización" : "Nueva Organización"}
          </span>
        }
        subtitle={
          editingOrg
            ? "Modifica los datos generales de esta flota."
            : "Ingresa los datos de la flota y el administrador inicial (Owner)."
        }
      >
        {error && <Alert variant="error" message={error} className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            label="Nombre de la Organización / Flota"
            placeholder="Ej. Cooperativa de Vehiculos Chiriquí"
            disabled={isSubmitting}
          />

          {editingOrg && (
            <>
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text font-bold text-xs text-base-content/85">
                    Estado de Suscripción
                  </span>
                </label>
                <select
                  value={subStatus}
                  onChange={(e) => setSubStatus(e.target.value)}
                  className="select select-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                  disabled={isSubmitting}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="PENDING_ACTIVATION">
                    Pendiente de Activación
                  </option>
                </select>
              </div>

              {subStatus === "ACTIVE" && (
                <Input
                  type="date"
                  required
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  label="Fecha de Expiración"
                  disabled={isSubmitting}
                />
              )}
            </>
          )}

          {!editingOrg && (
            <>
              <div className="divider my-1 text-[10px] text-base-content/50 font-black uppercase tracking-wider">
                Datos del Propietario (Owner)
              </div>

              <Input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                label="Nombre Completo"
                placeholder="Ej. Carlos Mendoza"
                disabled={isSubmitting}
              />

              <Input
                type="email"
                required
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                label="Correo Electrónico"
                placeholder="carlos@correo.com"
                disabled={isSubmitting}
              />

              <Input
                type={showOwnerPassword ? "text" : "password"}
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                label="Contraseña (Mínimo 6 caracteres)"
                placeholder="Dejar vacío para usar 'Temporal123!'"
                disabled={isSubmitting}
                className="pr-10"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                    className="flex items-center text-base-content/40 hover:text-base-content/70 cursor-pointer"
                    title={
                      showOwnerPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showOwnerPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                }
              />
            </>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingOrg ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Desktop Users Modal */}
      {!isMobile && activeOrgForUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-base-900/60 backdrop-blur-md transition-all duration-300 animate-in fade-in"
            onClick={() => setActiveOrgForUsers(null)}
          ></div>
          <div className="card bg-base-100 w-full max-w-xl shadow-2xl border border-base-200 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="card-body p-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="card-title text-xl font-black flex items-center gap-2 text-base-content">
                  <Building2 className="text-primary size-6" />
                  {activeOrgForUsers.name}
                </h2>
                <button
                  onClick={() => setActiveOrgForUsers(null)}
                  className="btn btn-sm btn-ghost btn-square"
                >
                  <X className="size-5" />
                </button>
              </div>

              {userFormOpen
                ? renderUserForm()
                : renderUserList(activeOrgForUsers)}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Users Drawer (vaul) */}
      <MobileDrawer
        open={isMobile && !!activeOrgForUsers}
        onOpenChange={(open) => {
          if (!open) {
            setActiveOrgForUsers(null);
            setUserFormOpen(false);
          }
        }}
        title={activeOrgForUsers?.name || ""}
        subtitle="Gestión de Accesos"
        onBack={userFormOpen ? () => setUserFormOpen(false) : undefined}
        onClose={() => {
          setActiveOrgForUsers(null);
          setUserFormOpen(false);
        }}
      >
        {activeOrgForUsers && (
          <div className="p-5">
            {userFormOpen
              ? renderUserForm()
              : renderUserList(activeOrgForUsers)}
          </div>
        )}
      </MobileDrawer>
    </div>
  );
}
