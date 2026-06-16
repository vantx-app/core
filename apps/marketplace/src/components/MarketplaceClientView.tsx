"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../utils/client/api-client";
import { VerificationTab } from "./VerificationTab";
import { VehicleListingsTab } from "./VehicleListingsTab";
import { AdminDocumentsReviewTab } from "./AdminDocumentsReviewTab";
import { MarketplaceDriverProfileView } from "./MarketplaceDriverProfileView";

/** Categorías oficiales de la ATTT de Panamá. */
type PanamaLicenseType =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E1"
  | "E2"
  | "E3"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J";

const LICENSE_TYPE_OPTIONS: { value: PanamaLicenseType; label: string }[] = [
  { value: "A", label: "A - Motocicletas" },
  { value: "B", label: "B - Automóviles Particulares" },
  { value: "C", label: "C - Vehículos Livianos de Uso Comercial" },
  { value: "D", label: "D - Comercial / Particular" },
  { value: "E1", label: "E1 - Transporte Selectivo" },
  { value: "E2", label: "E2 - Buses / Colectivo" },
  { value: "E3", label: "E3 - Transporte Colectivo de Dos Pisos" },
  { value: "F", label: "F - Equipo Pesado" },
  { value: "G", label: "G - Maquinaria Agrícola" },
  { value: "H", label: "H - Cuadriciclos / Vehículos Especiales" },
  { value: "I", label: "I - Vehículos de Emergencia" },
  { value: "J", label: "J - Instructor de Manejo" },
];

import {
  getInitials,
  maskDriverName,
  getDocStatusBadge,
  getDocStatusText,
} from "../utils/client/format";
import {
  Car,
  User,
  ShieldCheck,
  Filter,
  Star,
  LogOut,
  Lock,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";
import { Logo } from "@vantx/ui";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  organization?: {
    name: string;
  } | null;
  driver?: {
    id: string;
    nationalId: string;
    phone?: string | null;
    status: string;
  } | null;
}

interface DriverProfileStats {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  status: string;
  /** Single category (e.g. "D") or comma-joined multi-category (e.g. "C, D"). */
  licenseType: PanamaLicenseType | string | null;
}

interface MarketplaceDriver {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  nationalId: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** Single category (e.g. "D") or comma-joined multi-category (e.g. "C, D"). */
  licenseType?: PanamaLicenseType | string | null;
  globalStats: {
    globalOverallScore: number | null;
    globalSafetyScore: number | null;
    globalEcoScore: number | null;
  } | null;
  documents?: {
    type: string;
    status: string;
  }[];
}

interface MarketplaceClientViewProps {
  initialUser: UserProfile | null;
  initialDriverStats: DriverProfileStats | null;
  initialDrivers: MarketplaceDriver[];
}

export function MarketplaceClientView({
  initialUser,
  initialDriverStats,
  initialDrivers,
}: MarketplaceClientViewProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [driverStats, setDriverStats] = useState<DriverProfileStats | null>(
    initialDriverStats,
  );
  const [drivers, setDrivers] = useState<MarketplaceDriver[]>(initialDrivers);
  const [activeTab, setActiveTab] = useState<
    "drivers" | "documents" | "vehicles" | "validation" | "profile"
  >(initialUser?.role === "DRIVER" ? "vehicles" : "drivers");

  const [driversLoading, setDriversLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [zoneFilter, setZoneFilter] = useState("Todas");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001/dashboard";

  // Re-fetch profile & stats when required (e.g. sync callbacks)
  const syncProfileAndState = async () => {
    try {
      const { data } = await api.get<UserProfile>("/users/me");
      setUser(data);

      if (data.role === "DRIVER" || data.driver) {
        const statsRes = await api.get<DriverProfileStats>("/drivers/me/stats");
        setDriverStats(statsRes.data);
      } else {
        fetchAvailableDrivers(data);
      }
    } catch (err) {
      console.error("Error syncing profile state:", err);
    }
  };

  const fetchAvailableDrivers = async (currentUser?: UserProfile | null) => {
    try {
      setDriversLoading(true);
      const resolvedUser = currentUser !== undefined ? currentUser : user;
      const isOwner =
        resolvedUser?.role === "OWNER" ||
        resolvedUser?.role === "ADMIN" ||
        resolvedUser?.role === "SUPER_ADMIN";

      const url = isOwner ? "/drivers?available=true" : "/drivers/public";
      const { data } = await api.get<MarketplaceDriver[]>(url);
      setDrivers(data);
    } catch (err) {
      console.error("Error loading drivers:", err);
      setDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  };

  // Fetch drivers if filters change (can be done client-side or re-query client-side)
  useEffect(() => {
    // In initial render we skip fetching because initialDrivers matches initial state.
    // If user changes filters, we query with filters.
    if (categoryFilter !== "Todos" || zoneFilter !== "Todas") {
      // In this setup, we do client-side filtering or fetch filtered drivers.
      // Let's implement client-side filtering to make it super fast without extra server load,
      // but if the backend does it, we fetch. Since the original didn't implement backend query param filtering
      // on category/zone (it just loaded all available), we can filter the drivers list client-side!
    }
  }, [categoryFilter, zoneFilter]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const deleteSettings = getCookieSettings(0);
      Cookies.remove("access_token", { path: "/" });
      if (deleteSettings.domain) {
        Cookies.remove("access_token", {
          path: "/",
          domain: deleteSettings.domain,
        });
      }
      Cookies.remove("refresh_token", { path: "/" });
      if (deleteSettings.domain) {
        Cookies.remove("refresh_token", {
          path: "/",
          domain: deleteSettings.domain,
        });
      }
      window.location.href = `${landingUrl}/login`;
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const canViewAsOwner =
    user?.role === "OWNER" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";
  const canViewAsDriver = user?.role === "DRIVER" || !!user?.driver;
  const isDriverActive = driverStats?.status === "ACTIVE";
  const isOwner = canViewAsOwner;

  const tabsList = [];
  if (!user) {
    tabsList.push({
      id: "drivers",
      label: "Conductores Disponibles",
      icon: User,
    });
    tabsList.push({
      id: "vehicles",
      label: "Vehículos Disponibles",
      icon: Car,
    });
  } else {
    if (canViewAsOwner) {
      tabsList.push({
        id: "drivers",
        label: "Conductores Disponibles",
        icon: User,
      });
    }
    if (canViewAsDriver) {
      tabsList.push({
        id: "vehicles",
        label: "Vehículos Disponibles",
        icon: Car,
      });
      tabsList.push({
        id: "documents",
        label: "Mis Documentos",
        icon: ShieldCheck,
      });
      tabsList.push({ id: "profile", label: "Mi Perfil", icon: User });
    }
    if (user?.role === "SUPER_ADMIN") {
      tabsList.push({
        id: "validation",
        label: "Revisar Documentos",
        icon: ShieldCheck,
      });
    }
  }

  // Apply filters locally on the drivers list
  const filteredDrivers = drivers.filter((driver) => {
    const matchesCategory =
      categoryFilter === "Todos" ||
      (driver.licenseType &&
        // Support both single values and comma-joined multi-category (e.g. "C, D")
        driver.licenseType
          .split(",")
          .map((t) => t.trim())
          .includes(categoryFilter));
    return matchesCategory;
  });

  return (
    <div className="relative flex-grow flex flex-col w-full">
      {/* Header */}
      <header className="relative border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 transform-gpu">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm font-semibold text-slate-400 border-l border-slate-200 pl-3 hidden sm:inline whitespace-nowrap">
              Marketplace
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <a
                href={dashboardUrl}
                title="Volver al Dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm group"
              >
                <LayoutDashboard className="size-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                <span className="hidden sm:inline text-slate-600 group-hover:text-slate-900 transition-colors">
                  Dashboard
                </span>
              </a>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (canViewAsDriver) {
                      setActiveTab("profile");
                    } else {
                      window.location.href = dashboardUrl;
                    }
                  }}
                  title={
                    canViewAsDriver
                      ? "Ver mi perfil de conductor"
                      : "Ir al Dashboard de Propietario"
                  }
                  className="avatar placeholder cursor-pointer active:scale-95 transition-all outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full"
                >
                  <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full w-8 h-8 font-bold text-xs shadow-sm flex items-center justify-center">
                    <span>{getInitials(user.name)}</span>
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  title="Cerrar Sesión"
                  className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-red-500 rounded-lg transition-all"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            ) : (
              <a
                href={`${landingUrl}/login`}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
              >
                Iniciar Sesión
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Middle Content Wrapper */}
      <div className="flex-grow flex flex-col w-full">
        {/* Navigation Tabs */}
        {tabsList.length > 1 && (
          <section className="border-b border-slate-200/80 bg-white w-full mb-8">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex gap-8 overflow-x-auto scrollbar-none">
                {tabsList.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 py-4 px-1 text-xs font-extrabold transition-all border-b-2 -mb-[2px] whitespace-nowrap shrink-0 ${isActive
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                        }`}
                    >
                      <Icon className="size-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Main Content Area */}
        <section
          className={`max-w-7xl mx-auto px-6 pb-20 flex-grow w-full ${tabsList.length > 1 ? "" : "mt-8"}`}
        >
          {activeTab === "vehicles" && (
            <VehicleListingsTab
              isDriverActive={isDriverActive}
              isGuest={!user}
            />
          )}
          {activeTab === "documents" && (
            <VerificationTab onSync={syncProfileAndState} />
          )}
          {activeTab === "profile" && driverStats && (
            <MarketplaceDriverProfileView
              initialUser={user}
              driver={driverStats}
              hideBackLink={true}
            />
          )}
          {activeTab === "validation" && user?.role === "SUPER_ADMIN" && (
            <AdminDocumentsReviewTab />
          )}
          {activeTab === "drivers" && (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar Filters */}
              <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-left">
                  <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-1.5">
                    <Filter className="size-4 text-blue-600" />
                    Filtrar Conductores
                  </h2>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">
                        TIPO DE LICENCIA
                      </label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      >
                        <option value="Todos">Todos</option>
                        {LICENSE_TYPE_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">
                        ZONA GEOGRÁFICA
                      </label>
                      <select
                        value={zoneFilter}
                        onChange={(e) => setZoneFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      >
                        <option>Todas</option>
                        <option>Zona Metropolitana</option>
                        <option>Zona Norte</option>
                        <option>Zona Centro</option>
                        <option>Zona Oeste</option>
                      </select>
                    </div>
                  </div>
                </div>
              </aside>

              {/* Drivers List (For Owners & Public Guests) */}
              <div className="flex-1 flex flex-col gap-6 text-left">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-slate-950">
                    Conductores Profesionales Disponibles
                  </h2>
                  <span className="text-xs text-slate-500 font-semibold">
                    {filteredDrivers.length} conductores encontrados
                  </span>
                </div>

                {driversLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-slate-200 rounded-2xl">
                    <Loader2 className="size-8 animate-spin text-blue-600" />
                    <p className="text-xs text-slate-500">
                      Cargando lista de conductores...
                    </p>
                  </div>
                ) : filteredDrivers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 py-16">
                    <User className="size-14 text-slate-300 mb-3" />
                    <h3 className="text-sm font-bold text-slate-700">
                      No hay conductores
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      No hay conductores disponibles actualmente para
                      reclutamiento en este momento.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-5 shadow-sm"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-0.5">
                            <h3 className="text-base font-extrabold text-slate-950">
                              {maskDriverName(driver, user?.role)}
                            </h3>
                            <p className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider">
                              Licencia: {driver.licenseType || "N/A"}
                            </p>
                            {isOwner && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span
                                  className={`badge text-[8px] font-bold border rounded-full px-1.5 py-0.5 leading-none shrink-0 ${getDocStatusBadge(
                                    driver,
                                    "NATIONAL_ID",
                                  )}`}
                                >
                                  Cédula:{" "}
                                  {getDocStatusText(driver, "NATIONAL_ID")}
                                </span>
                                <span
                                  className={`badge text-[8px] font-bold border rounded-full px-1.5 py-0.5 leading-none shrink-0 ${getDocStatusBadge(
                                    driver,
                                    "POLICE_RECORD",
                                  )}`}
                                >
                                  Historial Policivo:{" "}
                                  {getDocStatusText(driver, "POLICE_RECORD")}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                            Disponible
                          </span>
                        </div>

                        {/* Body stats */}
                        <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-3 text-xs">
                          {(() => {
                            const hasHistory =
                              (driver as any).hasHistory !== undefined
                                ? (driver as any).hasHistory
                                : !!driver.globalStats &&
                                (driver.globalStats.globalOverallScore !==
                                  null ||
                                  (driver.globalStats as any).overallScore !==
                                  null);
                            return (
                              <>
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide">
                                    Puntaje Histórico
                                  </span>
                                  <span className="font-extrabold text-slate-700 flex items-center gap-1 mt-0.5">
                                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                    {!hasHistory
                                      ? "Sin Historial"
                                      : driver.globalStats
                                        ?.globalOverallScore != null
                                        ? `${driver.globalStats.globalOverallScore} pts`
                                        : "N/A (Privado)"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide">
                                    Conducción Segura
                                  </span>
                                  <span className="font-extrabold text-slate-700 flex items-center gap-1 mt-0.5">
                                    <ShieldCheck className="size-3.5 text-blue-600" />
                                    {!hasHistory
                                      ? "Sin Historial"
                                      : driver.globalStats?.globalSafetyScore !=
                                        null
                                        ? `${driver.globalStats.globalSafetyScore}%`
                                        : "N/A (Privado)"}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                          {!user ? (
                            <>
                              <Link
                                href={`/drivers/${driver.id}`}
                                className="flex-1 text-center py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all active:scale-95"
                              >
                                Ver Perfil
                              </Link>
                              <button
                                onClick={() => setIsAuthModalOpen(true)}
                                className="flex-1 text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md active:scale-95 shadow-blue-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Lock className="size-3.5" />
                                Contactar
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/drivers/${driver.id}`}
                                className="flex-1 text-center py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all active:scale-95"
                              >
                                Ver Perfil
                              </Link>
                              <button className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md active:scale-95 shadow-blue-600/10">
                                Proponer Contrato
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <p>
          &copy; {new Date().getFullYear()} VantX Drivers Marketplace. Todos los
          derechos reservados.
        </p>
      </footer>

      {/* AUTH REQUIRED MODAL FOR GUESTS */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsAuthModalOpen(false)}
          />
          {/* Modal Content */}
          <div className="bg-white border border-slate-200 w-full max-w-md p-6 md:p-8 rounded-3xl relative z-10 animate-in fade-in zoom-in-95 duration-205 text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-4">
              <Lock className="size-6" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              Acceso Requerido
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Para contactar a un conductor o gestionar ofertas de trabajo,
              necesitas iniciar sesión o registrar tu cuenta en la plataforma.
            </p>

            <div className="flex flex-col gap-3">
              <a
                href={`${landingUrl}/login?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                Iniciar Sesión
              </a>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <a
                  href={`${landingUrl}/register`}
                  className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-350 text-slate-700 font-bold text-xs transition-all flex items-center justify-center text-center"
                >
                  Soy Conductor
                </a>
                <a
                  href={`${landingUrl}/contact?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                  className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-400 text-slate-800 font-bold text-xs transition-all flex items-center justify-center text-center shadow-sm"
                >
                  Soy Propietario
                </a>
              </div>
            </div>

            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="mt-6 text-xs text-slate-400 hover:text-slate-600 transition-colors font-semibold hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
