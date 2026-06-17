"use client";

import { BillingUserProfile, BillingVehicle, PricingSettings } from "@/types";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import {
  Car,
  Users,
  Shield,
  Settings,
  ShieldAlert,
  Building2,
  Loader2,
  ShieldCheck,
  CreditCard,
  Building,
  AlertCircle,
  Calendar,
  Send,
  Sparkles,
  UploadCloud,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { AdminCard } from "@/components/dashboard/AdminCard";
import api from "@/utils/client/api-client";
import { useTranslation } from "@/hooks/useTranslation";
import axios from "axios";

// ─── Billing Tab Types ────────────────────────────────────────────────────────

// ─── Billing Tab Component ────────────────────────────────────────────────────

function BillingTab() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<BillingUserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pfLoading, setPfLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "YAPPY">(
    "BANK_TRANSFER",
  );
  const [reference, setReference] = useState("");
  const [offlineSuccess, setOfflineSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Estados para tarifas de precios dinámicos
  const [pricing, setPricing] = useState<PricingSettings>({
    flatSaaSPrice: 49.0,
    geolocationPrice: 15.0,
    diagnosticsPrice: 30.0,
  });

  // Estados para subida de comprobante
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptKey, setReceiptKey] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get("/users/me");
      setProfile(data);
    } catch (err) {
      console.error("Error al cargar el perfil en facturación:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchPricing = async () => {
    try {
      const { data } = await api.get("/billing/settings");
      if (data) setPricing(data);
    } catch (err) {
      console.error(
        "Error al cargar configuración de precios en facturación:",
        err,
      );
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPricing();
  }, []);

  const handlePFCheckout = async () => {
    setPfLoading(true);
    setErrorMsg("");
    try {
      const { data } = await api.post("/billing/checkout/paguelofacil");
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No se recibió URL de redirección");
      }
    } catch (err: unknown) {
      console.error(err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(axiosErr.response?.data?.message || t("common.error"));
      setPfLoading(false);
    }
  };

  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    setOfflineLoading(true);
    setErrorMsg("");
    try {
      let finalReceiptKey = receiptKey;

      // Si hay un archivo seleccionado pero aún no ha sido subido, lo subimos
      if (receiptFile && !finalReceiptKey) {
        setUploadingReceipt(true);
        try {
          const { data: uploadData } = await api.post(
            "/billing/checkout/offline/upload-url",
            {
              contentType: receiptFile.type,
            },
          );
          const { uploadUrl, fileKey } = uploadData;

          await axios.put(uploadUrl, receiptFile, {
            headers: { "Content-Type": receiptFile.type },
          });

          finalReceiptKey = fileKey;
          setReceiptKey(fileKey);
        } catch (uploadErr: unknown) {
          const axiosUploadErr = uploadErr as {
            response?: { data?: { message?: string } };
          };
          throw new Error(
            axiosUploadErr.response?.data?.message ||
              "Error al subir el comprobante de pago.",
          );
        } finally {
          setUploadingReceipt(false);
        }
      }

      await api.post("/billing/checkout/offline", {
        paymentMethod,
        reference: reference.trim(),
        receiptKey: finalReceiptKey || undefined,
      });
      setOfflineSuccess(true);
      setReference("");
      setReceiptFile(null);
      setReceiptKey(null);
      fetchProfile();
    } catch (err: unknown) {
      console.error(err);
      let message = t("common.error");
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.message || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setErrorMsg(message);
    } finally {
      setOfflineLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const organization = profile?.organization;
  const subStatus = organization?.subscriptionStatus || "INACTIVE";
  const expiresAt = organization?.subscriptionExpiresAt;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : true;
  const isActive = subStatus === "ACTIVE" && !isExpired;

  // Calcular el monto total de suscripción dinámicamente
  const vehicles = organization?.vehicles || [];
  const activeCount = vehicles.filter(
    (v: BillingVehicle) => v.subscriptionTier === "ACTIVE",
  ).length;
  const totalAmount = activeCount * (pricing.geolocationPrice || 15.0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <div className="glass-card p-6 shadow-sm space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-base-content flex items-center gap-2">
          {t("billing.title")}
          <span className="badge badge-primary badge-outline text-[10px] font-bold tracking-wider px-2 py-2">
            PREMIUM
          </span>
        </h2>
        <p className="text-base-content/60 text-xs max-w-xl">
          {t("billing.subtitle")}
        </p>
      </div>

      {errorMsg && (
        <div className="alert alert-error text-white text-xs font-semibold shadow-md">
          <AlertCircle className="size-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CURRENT SUBSCRIPTION CARD */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card overflow-hidden">
            {/* Accent line */}
            <div
              className={`h-1.5 ${isActive ? "bg-gradient-to-r from-emerald-500 to-teal-500" : subStatus === "PENDING_ACTIVATION" ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-red-500 to-rose-500"}`}
            />

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs uppercase font-extrabold text-base-content/50 tracking-wider">
                  {t("billing.current_status")}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  {isActive ? (
                    <div className="flex items-center gap-1.5 text-success font-bold text-lg">
                      <ShieldCheck className="size-5" />
                      <span>{t("billing.active")}</span>
                    </div>
                  ) : subStatus === "PENDING_ACTIVATION" ? (
                    <div className="flex items-center gap-1.5 text-warning font-bold text-lg">
                      <Loader2 className="size-5 animate-spin" />
                      <span>{t("billing.pending")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-error font-bold text-lg">
                      <AlertCircle className="size-5" />
                      <span>
                        {isExpired && subStatus === "ACTIVE"
                          ? t("billing.expired")
                          : t("billing.inactive")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {organization && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-base-200/50 rounded-lg text-base-content/70 backdrop-blur-sm">
                      <Building className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                        Organización
                      </p>
                      <p className="text-sm font-semibold text-base-content">
                        {organization.name}
                      </p>
                    </div>
                  </div>

                  {expiresAt && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-base-200/50 rounded-lg text-base-content/70 backdrop-blur-sm">
                        <Calendar className="size-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                          {t("billing.expires_at")}
                        </p>
                        <p className="text-sm font-semibold text-base-content">
                          {new Date(expiresAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {organization.paymentMethod && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-base-200/50 rounded-lg text-base-content/70 backdrop-blur-sm">
                        <CreditCard className="size-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                          {t("billing.payment_method")}
                        </p>
                        <p className="text-sm font-semibold text-base-content uppercase">
                          {organization.paymentMethod}
                        </p>
                      </div>
                    </div>
                  )}

                  {organization.freeMatchCredits !== undefined && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-base-200/50 rounded-lg text-base-content/70 backdrop-blur-sm">
                        <Sparkles className="size-4 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                          Créditos de Emparejamiento
                        </p>
                        <p className="text-sm font-semibold text-base-content font-bold">
                          {organization.freeMatchCredits}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BENEFITS HIGHLIGHT CARD */}
          <div className="card bg-gradient-to-br from-blue-700 to-indigo-900 text-white shadow-md">
            <div className="card-body p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-yellow-300" />
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  Beneficios Premium
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-300">✓</span>
                  <span>
                    Telemetría en vivo sin restricciones de vehículos.
                  </span>
                </li>

                <li className="flex items-start gap-2">
                  <span className="text-yellow-300">✓</span>
                  <span>
                    Visualización completa de Calificaciones de Conductores.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* PRICING & PAYMENT GATEWAYS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-base-content">
                {t("billing.pricing_title")}
              </h3>
              <p className="text-xs text-base-content/60">
                {t("billing.pricing_subtitle")}
              </p>
            </div>

            {/* Plan Display Card */}
            <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-base-200/30 rounded-2xl border border-white/10 backdrop-blur-sm gap-4">
              <div>
                <h4 className="font-extrabold text-base text-base-content">
                  {t("billing.plan_name")}
                </h4>
                <p className="text-xs text-base-content/50">
                  Renovación mensual automática
                </p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-extrabold text-base-content">
                  ${totalAmount.toFixed(2)}
                </span>
                <span className="text-xs text-base-content/60 font-medium">
                  {t("billing.plan_period")}
                </span>
              </div>
            </div>

            {/* Gateway actions */}
            <div className="w-full">
              <button
                onClick={handlePFCheckout}
                disabled={pfLoading}
                className="btn w-full flex items-center justify-center gap-2 h-12 shadow-md font-bold text-sm rounded-xl cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 hover:brightness-110 active:scale-[0.98] transition-all duration-200"
              >
                {pfLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Building className="size-4" />
                    <span>{t("billing.pay_pf")}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* VEHICLE TELEMETRY SUBSCRIPTION SECTION */}
          <div className="glass-card p-6 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-500" />
                Administración de Telemetría por Vehículo
              </h3>
              <p className="text-xs text-base-content/60">
                Suscribe vehículos individuales a planes de rastreo y
                diagnóstico. Activar cualquier plan habilita el Marketplace de
                forma ilimitada.
              </p>
            </div>

            {organization?.vehicles && organization.vehicles.length > 0 ? (
              <div className="space-y-4">
                {organization.vehicles.map((vehicle: BillingVehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-base-200/30 rounded-xl border border-white/5 backdrop-blur-sm gap-4 hover:border-white/20 transition-all duration-200"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-base-content">
                        {vehicle.alias || "Sin Alias"}
                      </h4>
                      <div className="flex gap-2 mt-1">
                        <span className="badge badge-sm badge-outline text-[10px] uppercase font-bold tracking-wider px-2">
                          Placa: {vehicle.plateNumber}
                        </span>
                        {vehicle.trialActivated &&
                        vehicle.trialExpiresAt &&
                        new Date() < new Date(vehicle.trialExpiresAt) ? (
                          <span className="badge badge-sm badge-success text-[10px] uppercase font-bold tracking-wider px-2 text-white bg-emerald-500 border-none">
                            Prueba Gratuita (Expira:{" "}
                            {new Date(
                              vehicle.trialExpiresAt,
                            ).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                            )
                          </span>
                        ) : (
                          <span className="badge badge-sm bg-base-300/50 text-[10px] uppercase font-bold tracking-wider px-2">
                            {vehicle.subscriptionTier === "NONE"
                              ? "Sin Telemetría"
                              : "Telemetría Activa"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={vehicle.subscriptionTier || "NONE"}
                        onChange={async (e) => {
                          const newTier = e.target.value;
                          try {
                            setErrorMsg("");
                            await api.patch(`/vehicles/${vehicle.id}`, {
                              subscriptionTier: newTier,
                            });
                            fetchProfile();
                          } catch (err: unknown) {
                            const axiosErr = err as {
                              response?: { data?: { message?: string } };
                            };
                            setErrorMsg(
                              axiosErr.response?.data?.message ||
                                "Error al actualizar plan de vehículo",
                            );
                          }
                        }}
                        className="select select-sm select-bordered rounded-xl text-xs bg-base-100 focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-56"
                      >
                        <option value="NONE">Sin Telemetría (Gratuito)</option>
                        <option value="ACTIVE">
                          Telemetría Activa (${pricing.geolocationPrice || 15.0}
                          /mes)
                        </option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-base-200/20 rounded-xl border border-dashed border-white/10">
                <p className="text-xs text-base-content/50">
                  No hay vehículos registrados en tu organización.
                </p>
              </div>
            )}
          </div>

          {/* OFFLINE PANAMA ACH/YAPPY INSTRUCTIONS */}
          <div className="glass-card p-6 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-md font-bold text-base-content flex items-center gap-2">
                <Building className="size-4 text-primary" />
                {t("billing.offline_instructions_title")}
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                {t("billing.offline_instructions_desc")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-base-200/20 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="space-y-1">
                <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                  Transferencia Bancaria ACH
                </p>
                <p className="text-xs font-semibold text-base-content">
                  {t("billing.bank_details")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider">
                  Yappy Directo
                </p>
                <p className="text-xs font-bold text-primary">
                  {t("billing.yappy_details")}
                </p>
              </div>
            </div>

            {offlineSuccess ? (
              <div className="alert alert-success text-white text-xs font-semibold shadow-md flex items-start gap-2">
                <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p>{t("billing.ref_success")}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOfflineSubmit} className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-base-content/75 uppercase tracking-wide">
                      {t("billing.payment_method")}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("BANK_TRANSFER")}
                        className={`flex-1 btn btn-sm font-bold text-xs h-10 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === "BANK_TRANSFER" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-sm" : "bg-base-100/60 backdrop-blur-sm hover:bg-base-200/70 border-base-200/60"}`}
                      >
                        ACH / Banco General
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("YAPPY")}
                        className={`flex-1 btn btn-sm font-bold text-xs h-10 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === "YAPPY" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-sm" : "bg-base-100/60 backdrop-blur-sm hover:bg-base-200/70 border-base-200/60"}`}
                      >
                        Yappy
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <label
                      htmlFor="refInput"
                      className="text-xs font-bold text-base-content/75 uppercase tracking-wide"
                    >
                      {t("billing.reference_label")}
                    </label>
                    <input
                      id="refInput"
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={t("billing.reference_placeholder")}
                      className="input input-bordered input-sm h-10 w-full text-xs font-semibold rounded-xl bg-base-100/60 backdrop-blur-sm border-base-200/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      required
                    />
                  </div>
                </div>

                {/* Subida de Archivo Comprobante */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control w-full space-y-2">
                    <label className="text-xs font-bold text-base-content/75 uppercase tracking-wide">
                      Subir Comprobante (Imagen o PDF)
                    </label>
                    <label className="flex items-center justify-center border-2 border-dashed border-base-300 rounded-xl p-4 cursor-pointer hover:bg-base-200/30 transition-all duration-200 gap-2 h-14 bg-base-100/60 backdrop-blur-sm">
                      {uploadingReceipt ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <UploadCloud className="size-5 text-base-content/50" />
                      )}
                      <span className="text-xs font-semibold text-base-content/75 truncate max-w-xs">
                        {receiptFile
                          ? receiptFile.name
                          : "Seleccionar comprobante"}
                      </span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setReceiptFile(file);
                            setReceiptKey(null);
                          }
                        }}
                        disabled={offlineLoading || uploadingReceipt}
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-center p-4 bg-base-200/20 rounded-xl border border-white/5 text-[11px] text-base-content/60 leading-normal">
                    Formatos soportados: JPG, PNG, PDF. Subir el comprobante
                    ayuda a los administradores a validar su pago de forma más
                    rápida.
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={
                      offlineLoading || uploadingReceipt || !reference.trim()
                    }
                    className="btn btn-sm h-10 px-5 shadow-md text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 hover:brightness-110 active:scale-95 transition-all duration-200"
                  >
                    {offlineLoading || uploadingReceipt ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>{t("billing.submit_reference")}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabKey = "overview" | "billing";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  roles: string[];
}[] = [
  {
    key: "overview",
    label: "Panel",
    icon: Settings,
    roles: [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN],
  },
  {
    key: "billing",
    label: "Facturación",
    icon: CreditCard,
    roles: [ROLES.OWNER, ROLES.ADMIN],
  },
];

// ─── Admin Overview (existing cards) ─────────────────────────────────────────

function AdminOverviewTab() {
  const searchParams = useSearchParams();
  const targetOrgId = searchParams.get("targetOrgId");
  const { role } = useAuth();

  const getLink = (path: string) =>
    targetOrgId ? `${path}?targetOrgId=${targetOrgId}` : path;

  const isOwnerOrSuper = role === ROLES.OWNER || role === ROLES.SUPER_ADMIN;
  const hasOrgContext = role !== ROLES.SUPER_ADMIN || !!targetOrgId;
  const canEditOrgs = role === ROLES.SUPER_ADMIN && !targetOrgId;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Card 0: Organizaciones (Solo Super Admin) */}
      {role === ROLES.SUPER_ADMIN && (
        <AdminCard
          href={getLink("/organizations")}
          icon={Building2}
          iconColorClass="bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white"
          title="Organizaciones"
          description="Administra las flotas asociadas a la plataforma, registra nuevas organizaciones, edita sus datos y gestiona sus respectivos usuarios."
          disabled={!canEditOrgs}
          disabledBadge="Vista Impersonada"
          disabledDescription={
            <>
              Administra las flotas asociadas a la plataforma.{" "}
              <strong className="text-primary/60">
                Sal de la vista de Owner para poder editar organizaciones.
              </strong>
            </>
          }
          disabledTitleAttr="No disponible en modo de vista (impersonación)"
        />
      )}

      {/* Card 1: Vehículos */}
      <AdminCard
        href={getLink("/vehicle")}
        icon={Car}
        iconColorClass="bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
        title="Vehículos de la Flota"
        description="Visualiza el listado de vehículos, sus estados en tiempo real (en mantenimiento, activo), registra unidades nuevas y administra las asignaciones de conductores."
        disabled={!hasOrgContext}
        disabledBadge="Requiere Organización"
        disabledDescription={
          <>
            Visualiza el listado de vehículos y sus estados en tiempo real.{" "}
            <strong className="text-primary/60">
              Selecciona una organización primero.
            </strong>
          </>
        }
        disabledTitleAttr="Requiere seleccionar una organización para impersonar"
      />

      {/* Card 2: Conductores */}
      <AdminCard
        href={getLink("/drivers")}
        icon={Users}
        iconColorClass="bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
        title="Conductores"
        description="Directorio completo de choferes. Consulta sus identificaciones, estados de verificación de cuenta y sus puntajes de seguridad, eficiencia de operación y cuidado del motor."
        disabled={!hasOrgContext}
        disabledBadge="Requiere Organización"
        disabledDescription={
          <>
            Directorio completo de choferes y consulta de sus estados y
            puntajes.{" "}
            <strong className="text-primary/60">
              Selecciona una organización primero.
            </strong>
          </>
        }
        disabledTitleAttr="Requiere seleccionar una organización para impersonar"
      />

      {/* Card 3: Usuarios / Equipo */}
      <AdminCard
        href={getLink("/users")}
        icon={Shield}
        iconColorClass="bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
        title="Usuarios del Equipo"
        description="Administra las cuentas de administradores autorizados que gestionan la logística, registran vehículos y supervisan viajes dentro de tu organización."
        disabled={!hasOrgContext || !isOwnerOrSuper}
        disabledBadge={!hasOrgContext ? "Requiere Organización" : "Bloqueado"}
        disabledDescription={
          !hasOrgContext ? (
            <>
              Administra las cuentas de administradores autorizados que
              gestionan la logística.{" "}
              <strong className="text-primary/60">
                Selecciona una organización primero.
              </strong>
            </>
          ) : (
            <>
              Administra las cuentas de administradores autorizados que
              gestionan la logística.{" "}
              <strong className="text-primary/60">
                Requiere rol de Propietario (Owner).
              </strong>
            </>
          )
        }
        disabledTitleAttr={
          !hasOrgContext
            ? "Requiere seleccionar una organización para impersonar"
            : "Solo disponible para Propietarios de la organización (Owner)"
        }
      />

      {/* Card 4: Portal de Reclutamiento (Marketplace) */}
      <AdminCard
        href={
          process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3002"
        }
        isExternalLink={true}
        icon={Briefcase}
        iconColorClass="bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
        title="Portal de Reclutamiento"
        description="Accede al Marketplace de conductores. Publica ofertas de alquiler de vehículos y gestiona postulaciones de choferes profesionales."
      />
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

function AdminPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role } = useAuth();

  // Comprobar si el rol actual es apto para administración
  const isAllowed = [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN].includes(
    role,
  );
  if (!isAllowed) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6 pt-12">
        <div className="card bg-base-100/60 backdrop-blur-md border border-error/30 shadow-2xl p-8 rounded-3xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-error/10 text-error flex items-center justify-center rounded-2xl">
            <ShieldAlert className="size-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-base-content">
              Acceso Denegado
            </h2>
            <p className="text-base-content/60 text-sm max-w-md mx-auto">
              No tienes los permisos necesarios para ver esta sección. Solo los
              administradores o propietarios de la organización pueden acceder
              aquí.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Leer el tab activo desde los query params
  const tabParam = searchParams.get("tab") as TabKey | null;
  const activeTab: TabKey =
    tabParam === "billing" && [ROLES.OWNER, ROLES.ADMIN].includes(role)
      ? "billing"
      : "overview";

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    router.push(`/admin?${params.toString()}`, { scroll: false });
  };

  // Filtrar tabs visibles según el rol
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(role));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Settings className="text-primary size-7" />
            Panel de Administración
          </h1>
          <p className="text-base-content/60 text-sm mt-0.5">
            Configura y gestiona las operaciones, vehículos, conductores y
            accesos de tu organización.
          </p>
        </div>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 bg-base-200/50 backdrop-blur-sm p-1.5 rounded-2xl w-fit border border-base-300/50 shadow-inner">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`admin-tab-${tab.key}`}
                onClick={() => setTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-base-100 text-base-content shadow-md"
                    : "text-base-content/50 hover:text-base-content hover:bg-base-200/70"
                }`}
              >
                <Icon className={`size-4 ${isActive ? "text-primary" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content */}
      <div className="animate-in fade-in duration-200">
        {activeTab === "overview" && <AdminOverviewTab />}
        {activeTab === "billing" && <BillingTab />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">
            Cargando panel de administración...
          </p>
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
