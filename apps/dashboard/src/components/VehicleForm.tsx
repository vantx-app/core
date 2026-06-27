"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/utils/enums";
import api from "@/utils/client/api-client";
import {
  VehicleFormProps,
  NewVehiclePageOrg,
  VehicleFormValues,
} from "@/types";
import { Loader2, Save, Camera, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const ImeiScannerModal = dynamic(
  () => import("@/components/ImeiScannerModal"),
  { ssr: false },
);

const ImeiWarningModal = dynamic(
  () => import("@/components/ImeiWarningModal"),
  { ssr: false },
);

export default function VehicleForm({
  vehicleId,
  targetOrgId,
  onSuccess,
  onCancel,
}: VehicleFormProps) {
  const { role } = useAuth();
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [originalOdometer, setOriginalOdometer] = useState<string>("");
  const [fetchedLastOdometer, setFetchedLastOdometer] = useState<number>(0);
  const [originalImei, setOriginalImei] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [selectedOrgName, setSelectedOrgName] = useState("");

  const [organizations, setOrganizations] = useState<NewVehiclePageOrg[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  const [pendingPayload, setPendingPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [warningModalMode, setWarningModalMode] = useState<
    "create_no_imei" | "update_imei" | null
  >(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<VehicleFormValues>({
    defaultValues: {
      orgId: "",
      imei: "",
      alias: "",
      plateNumber: "",
      make: "",
      model: "",
      year: "",
      currentOdometer: "",
      fuelType: "",
    },
  });

  const watchedImei = watch("imei");

  // Load organizations if super admin (and creating a new vehicle)
  useEffect(() => {
    if (isSuperAdmin && !vehicleId) {
      const fetchOrgs = async () => {
        try {
          setIsLoadingOrgs(true);
          const { data } = await api.get("/organizations");
          setOrganizations(data);
          const resolvedOrg =
            data.find((org: NewVehiclePageOrg) => org.id === targetOrgId) ??
            data[0];
          if (resolvedOrg) {
            setValue("orgId", resolvedOrg.id);
            setSelectedOrgName(resolvedOrg.name);
          }
        } catch (err) {
          console.error("Error fetching organizations:", err);
          setError("No se pudieron cargar las organizaciones.");
        } finally {
          setIsLoadingOrgs(false);
        }
      };
      fetchOrgs();
    }
  }, [isSuperAdmin, vehicleId, targetOrgId, setValue]);

  // Load vehicle details if editing
  useEffect(() => {
    if (!vehicleId) return;

    const fetchVehicleDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get(`/vehicles/${vehicleId}`);
        if (data) {
          setOrgName(data.organization?.name || "");

          const lastOdo = data.liveState?.lastOdometer ?? 0;
          const initialOdo = data.initialOdometer ?? 0;
          setFetchedLastOdometer(lastOdo);
          const displayOdo = String(Math.round(initialOdo + lastOdo));
          setOriginalOdometer(displayOdo);

          setOriginalImei(data.imei || null);
          reset({
            alias: data.alias || "",
            imei: "",
            plateNumber: data.plateNumber || "",
            make: data.make || "",
            model: data.model || "",
            year: data.year ? Number(data.year) : "",
            currentOdometer: displayOdo,
            fuelType: data.fuelType || "",
          });
        }
      } catch (err) {
        console.error("Error loading vehicle details:", err);
        setError("No se pudieron cargar los detalles del vehículo.");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicleDetails();
  }, [vehicleId, reset]);

  const onSubmit = async (data: VehicleFormValues) => {
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        alias: data.alias || undefined,
        plateNumber: data.plateNumber.trim().toUpperCase(),
        make: data.make || undefined,
        model: data.model || undefined,
        year: data.year ? Number(data.year) : undefined,
        fuelType: data.fuelType || null,
      };

      if (!vehicleId) {
        // Modo creación
        const trimmedImei = data.imei?.trim();
        payload.imei = trimmedImei || undefined;
        payload.initialOdometer = data.currentOdometer
          ? Number(data.currentOdometer)
          : 0;

        if (isSuperAdmin) {
          if (!data.orgId) {
            setError("Debes seleccionar una organización.");
            return;
          }
          payload.orgId = data.orgId;
        }
        // Nota: para roles OWNER/ADMIN, el backend asigna orgId desde el token JWT.

        if (!trimmedImei) {
          // Sin dispositivo — solicitar confirmación antes de crear
          setPendingPayload(payload);
          setWarningModalMode("create_no_imei");
          return;
        }

        await api.post("/vehicles", payload);
      } else {
        // Modo edición
        if (data.currentOdometer !== originalOdometer) {
          payload.initialOdometer = data.currentOdometer
            ? Number(data.currentOdometer) - fetchedLastOdometer
            : 0;
        }

        const trimmedImei = data.imei?.trim();
        // 1. Determine if the IMEI actually changed and is valid
        const isImeiChanged = trimmedImei && trimmedImei !== originalImei;

        if (isImeiChanged) {
          payload.imei = trimmedImei;

          // 2. Intercept with a warning ONLY if we are overwriting an existing IMEI
          if (originalImei) {
            setPendingPayload(payload);
            setWarningModalMode("update_imei");
            return; // Stop execution here; the modal will handle the save later
          }
        }

        // 3. Fallthrough: If we didn't return early, save directly 
        // (Handles both: brand new IMEI added OR no IMEI changes made at all)
        await api.patch(`/vehicles/${vehicleId}`, payload);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(message || "Error al guardar el vehículo.");
    }
  };

  const handleModalConfirm = async () => {
    if (!pendingPayload) return;
    try {
      if (warningModalMode === "update_imei" && vehicleId) {
        await api.patch(`/vehicles/${vehicleId}`, pendingPayload);
      } else {
        await api.post("/vehicles", pendingPayload);
      }
      setPendingPayload(null);
      setWarningModalMode(null);
      onSuccess();
    } catch (err) {
      console.error(err);
      setPendingPayload(null);
      setWarningModalMode(null);
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(message || "Error al guardar el vehículo.");
    }
  };

  const handleModalCancel = () => {
    setPendingPayload(null);
    setWarningModalMode(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-xs text-base-content/60">
          Cargando información del vehículo...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error" message={error} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Super Admin: Organization selection (only in Create mode) */}
        {isSuperAdmin && !vehicleId && (
          <div className="form-control border-b border-base-200 pb-4">
            <label className="label py-1">
              <span className="label-text font-bold text-xs text-base-content/85 flex items-center gap-1.5">
                <Building2 className="size-4 text-primary" />
                Organización
              </span>
            </label>

            {targetOrgId ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm text-base-content/80">
                <Building2 className="size-4 text-primary shrink-0" />
                {isLoadingOrgs ? (
                  <span className="flex items-center gap-1.5 text-base-content/50">
                    <Loader2 className="size-3.5 animate-spin" />
                    Cargando...
                  </span>
                ) : (
                  <span className="font-semibold">
                    {selectedOrgName || targetOrgId}
                  </span>
                )}
              </div>
            ) : isLoadingOrgs ? (
              <div className="flex items-center gap-2 text-xs text-base-content/50 py-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Cargando organizaciones...
              </div>
            ) : (
              <select
                className="select select-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                required
                disabled={isSubmitting}
                {...register("orgId")}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Read-only organization context in Edit mode */}
        {vehicleId && orgName && (
          <div className="form-control border-b border-base-200 pb-4">
            <label className="label py-1">
              <span className="label-text font-bold text-xs text-base-content/85 flex items-center gap-1.5">
                <Building2 className="size-4 text-primary" />
                Organización
              </span>
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-base-200/60 border border-base-300 rounded-xl text-sm text-base-content/70 cursor-default select-none">
              <Building2 className="size-4 text-base-content/40 shrink-0" />
              <span className="font-medium">{orgName}</span>
              <span className="ml-auto text-[10px] text-base-content/40 italic">
                No editable
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            type="text"
            label={
              vehicleId
                ? "Nuevo IMEI del Dispositivo GPS"
                : "IMEI del Dispositivo GPS (Opcional)"
            }
            placeholder="Ej. 863242045551234"
            className="font-mono pr-12 md:pr-4"
            disabled={isSubmitting}
            rightIcon={
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="btn btn-ghost btn-circle btn-sm text-primary hover:bg-primary/10 transition-all duration-200 md:hidden"
                title="Escanear IMEI"
                disabled={isSubmitting}
              >
                <Camera className="size-4" />
              </button>
            }
            helperText={
              vehicleId
                ? "Dejar vacío para mantener el dispositivo actual."
                : "Código único del dispositivo GPS."
            }
            {...register("imei")}
          />

          <Input
            type="text"
            required
            label="Número de Placa"
            placeholder="Ej. AB1234"
            className="uppercase"
            disabled={isSubmitting}
            {...register("plateNumber", {
              required: true,
              onChange: (e) =>
                setValue("plateNumber", e.target.value.toUpperCase()),
            })}
          />

          <Input
            type="text"
            label="Alias del Vehículo"
            placeholder="Ej. Vehículo Cisterna #3"
            disabled={isSubmitting}
            {...register("alias")}
          />

          <Input
            type="text"
            label="Marca"
            placeholder="Ej. Toyota"
            disabled={isSubmitting}
            {...register("make")}
          />

          <Input
            type="text"
            label="Modelo"
            placeholder="Ej. Hilux"
            disabled={isSubmitting}
            {...register("model")}
          />

          <Input
            type="number"
            label="Año"
            placeholder="Ej. 2023"
            disabled={isSubmitting}
            {...register("year")}
          />

          <Input
            type="number"
            label={
              !vehicleId
                ? "Kilometraje inicial (km)"
                : "Kilometraje actual (km)"
            }
            placeholder="Ej. 120000"
            disabled={isSubmitting}
            helperText={
              !vehicleId
                ? "Kilometraje base del vehículo al momento de registrarlo."
                : "Kilometraje real actual del vehículo."
            }
            {...register("currentOdometer")}
          />

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs text-base-content/85">
                Tipo de Combustible (Opcional)
              </span>
            </label>
            <select
              className="select select-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              disabled={isSubmitting}
              {...register("fuelType")}
            >
              <option value="">No Especificado</option>
              <option value="GASOLINE">Gasolina</option>
              <option value="DIESEL">Diésel</option>
              <option value="ELECTRIC">Eléctrico</option>
              <option value="HYBRID">Híbrido</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-base-200 justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="flex-1 sm:flex-initial"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<Save className="size-4" />}
            className="flex-1 sm:flex-initial min-w-[120px]"
          >
            {!vehicleId ? "Registrar" : "Guardar"}
          </Button>
        </div>
      </form>

      <ImeiScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(scannedImei) => setValue("imei", scannedImei)}
      />

      <ImeiWarningModal
        isOpen={warningModalMode !== null}
        mode={warningModalMode}
        currentImei={originalImei}
        newImei={watchedImei || ""}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
