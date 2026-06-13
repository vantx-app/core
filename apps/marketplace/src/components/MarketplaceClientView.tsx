"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../utils/client/api-client";
import { VerificationTab } from "./VerificationTab";
import { VehicleListingsTab } from "./VehicleListingsTab";
import { AdminDocumentsReviewTab } from "./AdminDocumentsReviewTab";
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
} from "lucide-react";
import Cookies from "js-cookie";
import { getCookieSettings } from "@vantx/auth";

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
  licenseType: string | null;
}

interface MarketplaceDriver {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  nationalId: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  licenseType?: string | null;
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
    "drivers" | "documents" | "vehicles" | "validation"
  >(
    initialUser?.role === "DRIVER" || initialUser?.driver
      ? "vehicles"
      : "drivers",
  );

  const [driversLoading, setDriversLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [zoneFilter, setZoneFilter] = useState("Todas");

  const landingUrl =
    process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

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
      Cookies.remove("access_token", {
        path: deleteSettings.path,
        domain: deleteSettings.domain,
      });
      Cookies.remove("refresh_token", {
        path: deleteSettings.path,
        domain: deleteSettings.domain,
      });
      window.location.href = `${landingUrl}/login`;
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isDriver = user?.role === "DRIVER";
  const isDriverActive = driverStats?.status === "ACTIVE";
  const isOwner =
    user?.role === "OWNER" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  // Apply filters locally on the drivers list
  const filteredDrivers = drivers.filter((driver) => {
    const matchesCategory =
      categoryFilter === "Todos" ||
      (driver.licenseType &&
        driver.licenseType.startsWith(categoryFilter.split(" ")[0]));
    // (If geographical zone is added in driver profile schema later, we filter. For now it passes)
    return matchesCategory;
  });

  return (
    <div className="relative">
      {/* Header */}
      <header className="relative border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 transform-gpu">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              VantX Drivers Marketplace
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <a
                href={dashboardUrl}
                className="text-sm font-semibold hover:text-slate-900 text-slate-500 transition-colors"
              >
                Volver al Dashboard
              </a>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="avatar placeholder">
                  <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full w-8 h-8 font-bold text-xs shadow-sm flex items-center justify-center">
                    <span>{getInitials(user.name)}</span>
                  </div>
                </div>
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

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-8">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-100 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="text-left">
            <h1 className="text-2xl font-extrabold text-slate-950">
              Asignaciones de Conductores y Vehículos
            </h1>
            <p className="text-slate-600 text-xs max-w-xl mt-1 leading-relaxed">
              Conectamos conductores profesionales verificados mediante firma
              digital con flotas comerciales. Explora vehículos disponibles o
              postúlate a asignaciones.
            </p>
          </div>
          {isDriver && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white shadow-sm shrink-0">
              <span className="text-xs text-slate-500 font-semibold">
                Tu Estado:
              </span>
              <span
                className={`badge text-xs font-bold px-2 py-0.5 rounded-full border ${
                  isDriverActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                }`}
              >
                {isDriverActive
                  ? "Activo (Verificado)"
                  : "Pendiente de Verificación"}
              </span>
            </div>
          )}
        </div>
      </section>
      {/* Navigation Tabs (Only for DRIVER) */}
      {isDriver && (
        <section className="max-w-7xl mx-auto px-6 mb-6">
          <div className="tabs tabs-boxed bg-slate-100 p-1 rounded-xl flex max-w-md">
            <button
              onClick={() => setActiveTab("vehicles")}
              className={`tab flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "vehicles"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              <Car className="size-4" />
              Vehículos Disponibles
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`tab flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "documents"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              <ShieldCheck className="size-4" />
              Mis Documentos
            </button>
          </div>
        </section>
      )}

      {/* Navigation Tabs (Only for SUPER_ADMIN) */}
      {user?.role === "SUPER_ADMIN" && (
        <section className="max-w-7xl mx-auto px-6 mb-6">
          <div className="tabs tabs-boxed bg-slate-100 p-1 rounded-xl flex max-w-md">
            <button
              onClick={() => setActiveTab("drivers")}
              className={`tab flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "drivers"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              <User className="size-4" />
              Conductores Disponibles
            </button>
            <button
              onClick={() => setActiveTab("validation")}
              className={`tab flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "validation"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-950"
              }`}
            >
              <ShieldCheck className="size-4" />
              Revisar Documentos
            </button>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        {isDriver ? (
          <div>
            {activeTab === "vehicles" && (
              <VehicleListingsTab isDriverActive={isDriverActive} />
            )}
            {activeTab === "documents" && (
              <VerificationTab onSync={syncProfileAndState} />
            )}
          </div>
        ) : activeTab === "validation" && user?.role === "SUPER_ADMIN" ? (
          <AdminDocumentsReviewTab />
        ) : (
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
                      <option>Todos</option>
                      <option>D (Comercial/Particular)</option>
                      <option>E1 (Transporte Selectivo)</option>
                      <option>E2 (Buses/Colectivo)</option>
                      <option>F (Equipo Pesado)</option>
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
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide">
                            Puntaje Histórico
                          </span>
                          <span className="font-extrabold text-slate-700 flex items-center gap-1 mt-0.5">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {driver.globalStats?.globalOverallScore != null
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
                            {driver.globalStats?.globalSafetyScore != null
                              ? `${driver.globalStats.globalSafetyScore}%`
                              : "N/A (Privado)"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        {!user ? (
                          <a
                            href={`${landingUrl}/login`}
                            className="w-full text-center py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-1.5"
                          >
                            <Lock className="size-3.5" />
                            Iniciar Sesión para Contactar
                          </a>
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

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <p>
          &copy; {new Date().getFullYear()} VantX Drivers Marketplace. Todos los
          derechos reservados.
        </p>
      </footer>
    </div>
  );
}
