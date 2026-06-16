"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../utils/client/api-client";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Award,
  Calendar,
  Phone,
  Mail,
  User,
  Info,
  Star,
  Clock,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import {
  maskDriverName,
  getDocStatusBadge,
  getDocStatusText,
} from "../utils/client/format";

interface MarketplaceDriverProfileViewProps {
  initialUser: any;
  driver: any;
  hideBackLink?: boolean;
}

export function MarketplaceDriverProfileView({
  initialUser,
  driver,
  hideBackLink = false,
}: MarketplaceDriverProfileViewProps) {
  const [user] = useState<any>(initialUser);
  const [proposing, setProposing] = useState(false);
  const [proposed, setProposed] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCallbackUrl(window.location.href);
    }
  }, []);

  const [shareScores, setShareScores] = useState(
    driver.shareScoresPublicly ?? false,
  );
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleToggleShare = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setUpdating(true);
    setUpdateError(null);
    try {
      await api.patch("/drivers/me/share-settings", {
        shareScoresPublicly: newValue,
      });
      setShareScores(newValue);
    } catch (err) {
      console.error("Error updating sharing settings:", err);
      setUpdateError("No se pudo actualizar la configuración de privacidad.");
    } finally {
      setUpdating(false);
    }
  };

  // Local helper functions for scores
  const getScoreCircleColor = (score: number | null | undefined): string => {
    if (score == null) return "stroke-slate-200";
    if (score >= 85) return "stroke-emerald-500";
    if (score >= 70) return "stroke-amber-500";
    return "stroke-rose-500";
  };

  const getScoreTextColor = (score: number | null | undefined): string => {
    if (score == null) return "text-slate-400";
    if (score >= 85) return "text-emerald-600";
    if (score >= 70) return "text-amber-600";
    return "text-rose-600";
  };

  const getScoreBadgeColor = (score: number | null | undefined): string => {
    if (score == null) return "bg-slate-100 text-slate-700 border-slate-200";
    if (score >= 85) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 70) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  const getScoreBgColor = (score: number | null | undefined): string => {
    if (score == null) return "bg-slate-50 border-slate-200";
    if (score >= 85) return "bg-emerald-50/50 border-emerald-100";
    if (score >= 70) return "bg-amber-50/50 border-amber-100";
    return "bg-rose-50/50 border-rose-100";
  };

  const getRankLabel = (score: number | null | undefined): string => {
    if (score == null) return "Privado";
    if (score >= 85) return "Excelente";
    if (score >= 70) return "Bueno";
    return "Precaución";
  };

  const getInitials = (name: string): string => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U"
    );
  };

  const handleProposeContract = async () => {
    setProposing(true);
    // Simular llamada de API
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setProposing(false);
    setProposed(true);
  };

  const isOwner =
    user?.role === "OWNER" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";

  const displayName = maskDriverName(driver, user?.role);

  // Scores
  const hasHistory =
    driver.hasHistory !== undefined
      ? driver.hasHistory
      : !!driver.globalStats &&
        (driver.globalStats.totalKm > 0 ||
          driver.globalStats.totalSnapshots > 0);

  const hasStats =
    driver.globalStats &&
    (driver.globalStats.globalOverallScore !== null ||
      driver.globalStats.overallScore !== null);

  const overallScore = hasStats
    ? (driver.globalStats.globalOverallScore ??
      driver.globalStats.overallScore ??
      null)
    : null;
  const safetyScore = hasStats
    ? (driver.globalStats.globalSafetyScore ??
      driver.globalStats.safetyScore ??
      null)
    : null;
  const ecoScore = hasStats
    ? (driver.globalStats.globalEcoScore ?? driver.globalStats.ecoScore ?? null)
    : null;
  const assetScore = hasStats
    ? (driver.globalStats.globalAssetScore ??
      driver.globalStats.assetScore ??
      null)
    : null;

  const totalKm = driver.globalStats?.totalKm ?? 0;
  const totalHours = driver.globalStats?.totalHours ?? 0;

  // Circle progress gauge calculation
  const radius = 46;
  const circumference = 2 * Math.PI * radius; // ~289.02
  const offset =
    overallScore !== null
      ? circumference -
        (circumference * Math.min(100, Math.max(0, overallScore))) / 100
      : circumference;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 relative z-10 text-left">
      {/* Back navigation */}
      {!hideBackLink && (
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-4" /> Volver al Marketplace
          </Link>
        </div>
      )}

      {proposed && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-fade-in">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-extrabold block">
              ¡Propuesta de Contrato Enviada!
            </span>
            <span className="font-medium text-emerald-700/90">
              Hemos notificado a {displayName}. Te enviaremos un correo cuando
              el conductor responda a tu oferta.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
            {/* Background design */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90" />

            <div className="relative mt-8 mb-4">
              <div className="avatar placeholder">
                <div className="bg-white text-slate-800 rounded-full w-24 h-24 font-extrabold text-2xl shadow-md border-4 border-slate-50 flex items-center justify-center">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {getInitials(
                      driver.firstName && driver.lastName
                        ? `${driver.firstName} ${driver.lastName}`
                        : driver.name,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-slate-950">
              {displayName}
            </h2>
            {driver.licenseType ? (
              <div className="flex items-center justify-center flex-wrap gap-1 mt-2">
                {driver.licenseType.split(",").map((cat: string) => (
                  <span
                    key={cat.trim()}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200"
                  >
                    Lic. {cat.trim()}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Sin Licencia Declarada
              </p>
            )}

            <div className="w-full border-t border-slate-100 my-5 pt-4 space-y-3.5 text-xs text-left">
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-400 font-semibold">
                  Identificación
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {isOwner ? driver.nationalId : "***-***-***"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-400 font-semibold">Celular</span>
                <span className="font-mono font-bold text-slate-800">
                  {isOwner && driver.phone ? driver.phone : "No disponible"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-400 font-semibold">
                  Estado de disponibilidad
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                  Disponible para contratar
                </span>
              </div>
            </div>

            {/* Actions for hiring */}
            <div className="w-full mt-2">
              {!user ? (
                <a
                  href={`${process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000"}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                  className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Lock className="size-4" />
                  Iniciar Sesión para Contactar
                </a>
              ) : isOwner ? (
                <button
                  onClick={handleProposeContract}
                  disabled={proposing || proposed}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs transition-all shadow-md active:scale-95 shadow-blue-600/10 flex items-center justify-center gap-1.5"
                >
                  {proposing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enviando oferta...
                    </>
                  ) : proposed ? (
                    <>
                      <Briefcase className="size-4" />
                      Propuesta Enviada
                    </>
                  ) : (
                    <>
                      <Briefcase className="size-4" />
                      Proponer Contrato de Flota
                    </>
                  )}
                </button>
              ) : user?.driver?.id === driver.id ||
                user?.id === driver.userId ? (
                <div className="p-4 rounded-xl bg-slate-550/5 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Sparkles className="size-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-extrabold">
                      Tu Perfil Público
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-550 font-semibold leading-relaxed">
                    Controla si los propietarios de flota pueden ver tus
                    puntuaciones de telemetría y desempeño en el Marketplace.
                  </p>
                  <div className="border-t border-slate-200/60 pt-3 flex items-center justify-between gap-3 text-left">
                    <span className="text-[10px] font-extrabold text-slate-700">
                      Compartir scores públicamente
                    </span>
                    <div className="flex items-center gap-2">
                      {updating && (
                        <Loader2 className="size-3.5 animate-spin text-blue-600" />
                      )}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={shareScores}
                          onChange={handleToggleShare}
                          disabled={updating}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  {updateError && (
                    <p className="text-[9px] text-red-500 font-semibold mt-1">
                      {updateError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-550/5 border rounded-xl text-center text-[11px] text-slate-500 font-semibold">
                  Vista de conductor (solo lectura)
                </div>
              )}
            </div>
          </div>

          {/* Compliance & verification documents card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-blue-600" />
              Documentación Verificada
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 text-xs">
                <span className="font-bold text-slate-700">
                  Cédula Nacional
                </span>
                <span
                  className={`badge text-[9px] font-bold border rounded-full px-2 py-0.5 leading-none shrink-0 ${getDocStatusBadge(
                    driver,
                    "NATIONAL_ID",
                  )}`}
                >
                  {getDocStatusText(driver, "NATIONAL_ID")}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 text-xs">
                <span className="font-bold text-slate-700">
                  Historial Policivo
                </span>
                <span
                  className={`badge text-[9px] font-bold border rounded-full px-2 py-0.5 leading-none shrink-0 ${getDocStatusBadge(
                    driver,
                    "POLICE_RECORD",
                  )}`}
                >
                  {getDocStatusText(driver, "POLICE_RECORD")}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              Los documentos de los conductores en el VantX Marketplace son
              verificados manualmente por el equipo de cumplimiento y
              resguardados mediante firma digital.
            </p>
          </div>
        </div>

        {/* Right Column: Score Summary */}
        <div className="lg:col-span-2 space-y-6">
          {!hasHistory ? (
            /* Friendly New Driver block */
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center text-center justify-center min-h-[500px]">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-5 shadow-inner">
                <Info className="size-10" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-950 mb-2">
                Conductor sin Historial Operativo
              </h3>
              <p className="text-slate-500 text-sm max-w-md mb-8 leading-relaxed">
                Este conductor se ha registrado recientemente en la plataforma y
                aún no posee historial de telemetría verificado o viajes
                registrados.
              </p>

              <div className="w-full max-w-md border border-slate-100 bg-slate-50/50 p-5 rounded-2xl text-left space-y-3.5 text-xs text-slate-600">
                <h4 className="font-bold text-slate-950 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Sparkles className="size-4 text-blue-600" />
                  Información para Reclutadores
                </h4>
                <ul className="space-y-2.5 leading-relaxed font-medium">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold shrink-0">1.</span>
                    <span>
                      Puedes proponerle un contrato para incorporarlo a tu flota
                      y comenzar a registrar sus viajes.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold shrink-0">2.</span>
                    <span>
                      Una vez que empiece a conducir un vehículo con el
                      dispositivo de telemetría instalado, sus puntajes y
                      estadísticas de conducción se generarán automáticamente.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          ) : overallScore === null ? (
            /* Privacy blocker card */
            <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-indigo-950 text-white rounded-2xl p-8 border border-slate-800 shadow-lg flex flex-col items-center text-center justify-center min-h-[500px]">
              <div className="p-4 bg-white/10 backdrop-blur-md text-amber-400 rounded-2xl mb-5 shadow-inner">
                <Lock className="size-10" />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-2">
                Puntaje de Conducción Privado
              </h3>
              <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
                Este conductor ha configurado su perfil de telemetría como
                privado. Los puntajes históricos solo son visibles para
                administradores o empresas que tengan un contrato o propuesta
                activa con él.
              </p>

              <div className="w-full max-w-md border border-white/10 bg-white/5 backdrop-blur-sm p-5 rounded-2xl text-left space-y-3.5 text-xs text-slate-300">
                <h4 className="font-bold text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-400" />
                  ¿Cómo desbloquear las calificaciones?
                </h4>
                <ul className="space-y-2.5 leading-relaxed font-medium">
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">
                      1.
                    </span>
                    <span>
                      Inicia sesión con tu cuenta de Propietario de Flota
                      (Hiring Manager).
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">
                      2.
                    </span>
                    <span>
                      Haz clic en el botón de{" "}
                      <strong>"Proponer Contrato"</strong> a la izquierda.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold shrink-0">
                      3.
                    </span>
                    <span>
                      Una vez aceptada tu propuesta de reclutamiento o
                      establecida la asignación, la telemetría operativa
                      detallada se habilitará automáticamente.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* Unmasked Scores view */
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Gauge card */}
                <div
                  className={`card border shadow-sm p-6 flex flex-col items-center justify-center text-center rounded-2xl bg-white ${getScoreBgColor(
                    overallScore,
                  )}`}
                >
                  <span className="text-slate-500 text-xs font-extrabold uppercase tracking-wider block mb-2">
                    Score General
                  </span>

                  <div className="relative flex items-center justify-center my-3">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r={radius}
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r={radius}
                        className={`${getScoreCircleColor(overallScore)} transition-all duration-1000`}
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center flex flex-col items-center justify-center">
                      <span
                        className={`text-3xl font-black ${getScoreTextColor(overallScore)}`}
                      >
                        {Math.round(overallScore)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                        pts
                      </span>
                    </div>
                  </div>

                  <span
                    className={`badge border font-black text-[10px] px-2.5 py-1 uppercase rounded-full ${getScoreBadgeColor(
                      overallScore,
                    )}`}
                  >
                    Rango: {getRankLabel(overallScore)}
                  </span>
                </div>

                {/* Info and operational totals */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-row items-center gap-4 hover:border-blue-500/20 transition-all">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                      <Award className="size-7" />
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider block">
                        KMs Conducidos
                      </span>
                      <span className="text-2xl font-black text-slate-800 block mt-1 font-mono">
                        {totalKm.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}{" "}
                        km
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-row items-center gap-4 hover:border-blue-500/20 transition-all">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                      <Clock className="size-7" />
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider block">
                        Horas al Volante
                      </span>
                      <span className="text-2xl font-black text-slate-800 block mt-1 font-mono">
                        {Math.round(totalHours)} hrs
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillars progress list */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                  Desglose de Pilares Evaluados
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Pillar 1: Safety */}
                  <div className="space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">
                      Seguridad Vial
                    </span>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-2xl font-black ${getScoreTextColor(safetyScore)} font-mono`}
                      >
                        {Math.round(safetyScore ?? 0)} pts
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Excelente: &ge; 85
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          safetyScore && safetyScore >= 85
                            ? "bg-emerald-500"
                            : safetyScore && safetyScore >= 70
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${safetyScore ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Pillar 2: Eco */}
                  <div className="space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">
                      Eco-Conducción
                    </span>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-2xl font-black ${getScoreTextColor(ecoScore)} font-mono`}
                      >
                        {Math.round(ecoScore ?? 0)} pts
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Excelente: &ge; 85
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          ecoScore && ecoScore >= 85
                            ? "bg-emerald-500"
                            : ecoScore && ecoScore >= 70
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${ecoScore ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Pillar 3: Asset */}
                  <div className="space-y-2 text-left">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">
                      Cuidado del Motor
                    </span>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-2xl font-black ${getScoreTextColor(assetScore)} font-mono`}
                      >
                        {Math.round(assetScore ?? 0)} pts
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Excelente: &ge; 85
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          assetScore && assetScore >= 85
                            ? "bg-emerald-500"
                            : assetScore && assetScore >= 70
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${assetScore ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly history table */}
              {driver.scoreSnapshots && driver.scoreSnapshots.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                    Historial de Desempeño Semanal
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="table w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2 text-left">
                            Período (Año - Sem.)
                          </th>
                          <th className="py-2 text-center">Score General</th>
                          <th className="py-2 text-center">Seguridad Vial</th>
                          <th className="py-2 text-center">Eco-Conducción</th>
                          <th className="py-2 text-center">
                            Cuidado del Motor
                          </th>
                          <th className="py-2 text-right">Distancia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                        {driver.scoreSnapshots.map((snap: any, idx: number) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="py-3 font-semibold text-slate-950 text-left">
                              Año {snap.year} - Sem. {snap.weekNumber}
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`badge border font-black text-[9px] px-2 py-0.5 rounded-full ${getScoreBadgeColor(
                                  snap.overallScore,
                                )}`}
                              >
                                {Math.round(snap.overallScore)} pts
                              </span>
                            </td>
                            <td className="py-3 text-center font-mono">
                              {Math.round(snap.safetyScore)}
                            </td>
                            <td className="py-3 text-center font-mono">
                              {Math.round(snap.ecoScore)}
                            </td>
                            <td className="py-3 text-center font-mono">
                              {Math.round(snap.assetScore)}
                            </td>
                            <td className="py-3 text-right font-mono text-slate-500">
                              {(snap.totalKm ?? 0).toFixed(1)} km
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
