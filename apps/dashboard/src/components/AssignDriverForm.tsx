"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import api from "@/utils/client/api-client";
import { AssignDriverFormProps, AssignVehicleDriver } from "@/types";
import { UserPlus, Loader2, UserCheck, UserX, Zap } from "lucide-react";
import { IdDocumentField } from "@/components/ui/IdDocumentField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function AssignDriverForm({
  vehicleId,
  initialDriver,
  onSuccess,
}: AssignDriverFormProps) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nationalIdInput, setNationalIdInput] = useState("");

  const [currentDriver, setCurrentDriver] = useState<
    AssignVehicleDriver | null | undefined
  >(initialDriver);
  const [isLoadingDriver, setIsLoadingDriver] = useState(
    initialDriver === undefined,
  );

  const [previousDrivers, setPreviousDrivers] = useState<AssignVehicleDriver[]>(
    [],
  );
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [usePreviousDropdown, setUsePreviousDropdown] = useState(false);
  const [selectedPreviousId, setSelectedPreviousId] = useState("");

  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle");
  const [verifiedDriverName, setVerifiedDriverName] = useState<string | null>(
    null,
  );
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [currentUserDriver, setCurrentUserDriver] = useState<{
    nationalId: string;
    name: string;
  } | null>(null);

  // Almacenar initialDriver en una referencia para evitar ejecuciones de useEffect innecesarias si cambia la referencia del objeto
  const initialDriverRef = useRef(initialDriver);
  useEffect(() => {
    initialDriverRef.current = initialDriver;
  }, [initialDriver]);

  const isInitialDriverUndefined = initialDriver === undefined;
  const initialDriverNationalId = initialDriver?.nationalId;
  const initialDriverName = initialDriver
    ? `${initialDriver.firstName} ${initialDriver.lastName}`
    : "";

  // Obtener el conductor actual si no fue proporcionado previamente
  useEffect(() => {
    if (!isInitialDriverUndefined) {
      setCurrentDriver(initialDriverRef.current);
      setIsLoadingDriver(false);
      setShowAssignForm(initialDriverRef.current ? false : true);
      return;
    }

    const fetchCurrentDriver = async () => {
      setIsLoadingDriver(true);
      try {
        const { data } = await api.get(`/vehicles/${vehicleId}/driver`);
        const drv = data?.driver || null;
        setCurrentDriver(drv);
        setShowAssignForm(drv ? false : true);
      } catch (err) {
        console.error("Error al obtener el conductor actual:", err);
      } finally {
        setIsLoadingDriver(false);
      }
    };

    fetchCurrentDriver();
  }, [
    vehicleId,
    isInitialDriverUndefined,
    initialDriverNationalId,
    initialDriverName,
  ]);

  // Debounced search / verify by national ID
  useEffect(() => {
    if (usePreviousDropdown) {
      setVerificationStatus("idle");
      setVerifiedDriverName(null);
      return;
    }

    const trimmed = nationalIdInput.trim();
    if (!trimmed || trimmed.length < 3) {
      setVerificationStatus("idle");
      setVerifiedDriverName(null);
      return;
    }

    setVerificationStatus("loading");
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await api.get(
          `/drivers/verify-id/${encodeURIComponent(trimmed)}`,
        );
        if (data.exists) {
          setVerificationStatus("found");
          const name =
            data.firstName && data.lastName
              ? `${data.firstName} ${data.lastName}`
              : data.firstName || data.lastName || data.nationalId;
          setVerifiedDriverName(name);
        } else {
          setVerificationStatus("not_found");
          setVerifiedDriverName(null);
        }
      } catch (err) {
        console.error("Error al verificar cédula:", err);
        setVerificationStatus("error");
        setVerifiedDriverName(null);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [nationalIdInput, usePreviousDropdown]);

  // Load previous drivers and current user driver on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data } = await api.get("/users/me");
        if ((data.role === "OWNER" || data.role === "ADMIN") && data.driver) {
          setCurrentUserDriver({
            nationalId: data.driver.nationalId,
            name: data.name,
          });
        }
      } catch {
        // Fallo silencioso
      }
    };

    const fetchPreviousDrivers = async () => {
      setIsLoadingPrevious(true);
      try {
        const { data } = await api.get(
          `/vehicles/${vehicleId}/previous-drivers`,
        );
        const prevList = data || [];
        setPreviousDrivers(prevList);
        if (prevList.length > 0) {
          setUsePreviousDropdown(true);
          setSelectedPreviousId(prevList[0].nationalId);
        }
      } catch (err) {
        console.error("Error al obtener conductores históricos:", err);
      } finally {
        setIsLoadingPrevious(false);
      }
    };

    fetchCurrentUser();
    fetchPreviousDrivers();
  }, [vehicleId]);

  const handleAssign = async (nationalIdToAssign: string) => {
    const trimmed = nationalIdToAssign.trim();
    if (!trimmed) return;
    setApiError(null);
    setIsSubmitting(true);

    try {
      await api.post(`/vehicles/${vehicleId}/assign`, { nationalId: trimmed });
      // Fetch fresh details
      const { data } = await api.get(`/vehicles/${vehicleId}/driver`);
      const drv = data?.driver || null;
      setCurrentDriver(drv);
      setShowAssignForm(false);
      if (onSuccess) onSuccess();
      else router.refresh();
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setApiError(message || "Error al asignar conductor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!confirm("¿Estás seguro de que deseas desvincular a este conductor?"))
      return;
    setApiError(null);
    setIsSubmitting(true);

    try {
      await api.post(`/vehicles/${vehicleId}/unassign`);
      setCurrentDriver(null);
      setShowAssignForm(true);
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setApiError(message || "Error al desvincular el conductor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const idToAssign = usePreviousDropdown
      ? selectedPreviousId
      : nationalIdInput;
    await handleAssign(idToAssign);
  };

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  if (isLoadingDriver) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-xs text-base-content/65">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>Obteniendo conductor actual...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Current Driver Status Card */}
      <div className="border border-base-200 bg-base-200/20 rounded-xl p-4 animate-in fade-in duration-200">
        {currentDriver ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2 text-emerald-700 dark:text-emerald-400">
              <UserCheck className="size-5 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                  Asignado:
                </span>
                <span className="font-bold text-sm block mt-0.5">
                  {currentDriver.firstName && currentDriver.lastName
                    ? `${currentDriver.firstName} ${currentDriver.lastName}`
                    : currentDriver.nationalId}
                </span>
                {(currentDriver.firstName || currentDriver.lastName) && (
                  <span className="text-[9px] block opacity-60 font-mono mt-0.5">
                    Cédula: {currentDriver.nationalId}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="error"
              size="xs"
              className="btn-outline"
              onClick={handleUnassign}
              disabled={isSubmitting}
            >
              Desvincular
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
            <UserX className="size-5 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                Estado:
              </span>
              <span className="font-semibold text-xs block mt-0.5">
                Sin conductor asignado
              </span>
            </div>
          </div>
        )}

        {currentDriver && !showAssignForm && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 gap-1.5 rounded-xl text-xs"
            onClick={() => setShowAssignForm(true)}
          >
            Cambiar Conductor
          </Button>
        )}
      </div>

      {showAssignForm && (
        <div className="space-y-4 animate-in slide-in-from-bottom-3 duration-250">
          <div className="divider my-0 opacity-40"></div>

          {/* Quick Access: Self-assignment */}
          {currentUserDriver &&
            (!currentDriver ||
              currentDriver.nationalId !== currentUserDriver.nationalId) && (
              <>
                <div className="flex items-center justify-between gap-3 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-extrabold text-[11px] flex items-center justify-center shadow-sm">
                      {getInitials(currentUserDriver.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <UserCheck className="size-3" /> Tu perfil
                      </p>
                      <p className="text-xs font-semibold text-base-content truncate">
                        {currentUserDriver.name}
                      </p>
                      <p className="text-[9px] font-mono text-base-content/50">
                        {currentUserDriver.nationalId}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant="success"
                    onClick={() => handleAssign(currentUserDriver.nationalId)}
                    disabled={isSubmitting}
                    leftIcon={<Zap className="size-3" />}
                    className="shadow hover:brightness-110 active:scale-95 transition-all duration-200 shrink-0"
                  >
                    Asignarme
                  </Button>
                </div>
                <div className="divider text-[9px] text-base-content/30 my-0">
                  o asigna otro conductor
                </div>
              </>
            )}

          {apiError && <Alert variant="error" message={apiError} />}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {isLoadingPrevious ? (
              <div className="flex items-center gap-2 text-xs text-base-content/50 py-3 justify-center">
                <Loader2 className="size-4 animate-spin text-primary" />
                Cargando historial de conductores...
              </div>
            ) : (
              <>
                {/* Tabs for History vs New Search */}
                {previousDrivers.length > 0 && (
                  <div className="tabs tabs-boxed w-full grid grid-cols-2 mb-2 bg-base-200/50 p-1 rounded-xl">
                    <button
                      type="button"
                      className={`tab tab-sm font-semibold rounded-lg transition-all duration-200 ${!usePreviousDropdown ? "tab-active bg-primary text-white shadow-sm" : "text-base-content/60"}`}
                      onClick={() => setUsePreviousDropdown(false)}
                    >
                      Nuevo Conductor
                    </button>
                    <button
                      type="button"
                      className={`tab tab-sm font-semibold rounded-lg transition-all duration-200 ${usePreviousDropdown ? "tab-active bg-primary text-white shadow-sm" : "text-base-content/60"}`}
                      onClick={() => setUsePreviousDropdown(true)}
                    >
                      Conductor Histórico
                    </button>
                  </div>
                )}

                {usePreviousDropdown && previousDrivers.length > 0 ? (
                  <div className="form-control space-y-1.5 animate-in fade-in duration-200">
                    <label className="label py-0.5">
                      <span className="label-text font-bold text-xs text-base-content/85">
                        Seleccionar Conductor Histórico
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-sm h-10 font-sans"
                      value={selectedPreviousId}
                      onChange={(e) => setSelectedPreviousId(e.target.value)}
                      disabled={isSubmitting}
                    >
                      {previousDrivers.map((driver) => (
                        <option
                          key={driver.nationalId}
                          value={driver.nationalId}
                        >
                          {driver.firstName && driver.lastName
                            ? `${driver.firstName} ${driver.lastName}`
                            : driver.nationalId}{" "}
                          ({driver.nationalId})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2.5 animate-in fade-in duration-200">
                    <IdDocumentField
                      value={nationalIdInput}
                      onChange={setNationalIdInput}
                      label="Documento del Conductor"
                      disabled={isSubmitting}
                    />

                    {/* Real-time Verification Status */}
                    {verificationStatus === "loading" && (
                      <div className="flex items-center gap-1.5 text-xs text-base-content/50 pl-0.5 mt-1">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span>Verificando conductor...</span>
                      </div>
                    )}
                    {verificationStatus === "found" && (
                      <Alert
                        variant="success"
                        message={
                          <div>
                            <span className="font-semibold">
                              Conductor encontrado:{" "}
                            </span>
                            <span className="font-bold">
                              {verifiedDriverName}
                            </span>
                          </div>
                        }
                      />
                    )}
                    {verificationStatus === "not_found" && (
                      <Alert
                        variant="warning"
                        message={
                          <span>
                            Este conductor no está registrado en el sistema.
                            Primero agrégalo en la sección de{" "}
                            <strong>Conductores</strong> para poder asignarlo.
                          </span>
                        }
                      />
                    )}
                    {verificationStatus === "error" && (
                      <Alert
                        variant="error"
                        message="Error al verificar el conductor en el sistema."
                      />
                    )}

                    {verificationStatus !== "not_found" && (
                      <span className="text-[9px] text-base-content/40 pl-0.5 block leading-relaxed">
                        Ingresa el documento para verificar la existencia del
                        perfil del conductor.
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 pt-2">
              {currentDriver && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAssignForm(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                isLoading={isSubmitting}
                leftIcon={<UserPlus className="size-4" />}
                className="flex-1"
                disabled={
                  usePreviousDropdown
                    ? !selectedPreviousId
                    : !nationalIdInput.trim() ||
                      verificationStatus === "loading" ||
                      verificationStatus === "not_found"
                }
              >
                Asignar Conductor
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
