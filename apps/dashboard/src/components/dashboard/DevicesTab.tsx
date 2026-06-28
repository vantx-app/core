"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/utils/client/api-client";
import {
  Cpu,
  RotateCw,
  PlusCircle,
  Link2,
  Link2Off,
  Radio,
  Layers,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  Signal,
  Calendar,
  Eye,
  Info,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

export function DevicesTab() {
  const [subTab, setSubTab] = useState<"devices" | "sim-cards">("devices");
  const [devices, setDevices] = useState<any[]>([]);
  const [simCards, setSimCards] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals state
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isLinkSimModalOpen, setIsLinkSimModalOpen] = useState(false);
  const [isLinkVehicleModalOpen, setIsLinkVehicleModalOpen] = useState(false);

  // Selected item state for linking
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);

  // Forms state
  const [newDevice, setNewDevice] = useState({ imei: "", model: "FMC003" });
  const [newSim, setNewSim] = useState({
    iccid: "",
    phoneNumber: "",
    carrier: "",
  });
  const [selectedSimId, setSelectedSimId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [devicesRes, simsRes, vehiclesRes] = await Promise.all([
        api.get("/devices"),
        api.get("/devices/sim-cards"),
        api.get("/vehicles"),
      ]);
      setDevices(devicesRes.data || []);
      setSimCards(simsRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err: any) {
      console.error("Error loading devices inventory:", err);
      setError("No se pudieron cargar los datos del inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncFota = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);
      const { data } = await api.post("/devices/sync-fota");
      if (data.success) {
        setSuccess(
          `Sincronización exitosa con FOTA Web: ${data.syncedCount} dispositivos procesados (${data.createdCount} nuevos, ${data.updatedCount} actualizados).`,
        );
        fetchData();
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      setError("Error al sincronizar con Teltonika FOTA Web.");
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      await api.post("/devices", newDevice);
      setSuccess(`Dispositivo IMEI ${newDevice.imei} registrado exitosamente.`);
      setIsDeviceModalOpen(false);
      setNewDevice({ imei: "", model: "FMC003" });
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Error al crear el dispositivo.");
    }
  };

  const handleCreateSim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      await api.post("/devices/sim-cards", newSim);
      setSuccess(`Tarjeta SIM ICCID ${newSim.iccid} registrada exitosamente.`);
      setIsSimModalOpen(false);
      setNewSim({ iccid: "", phoneNumber: "", carrier: "" });
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || "Error al registrar la tarjeta SIM.",
      );
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("file", file);

      const { data } = await api.post("/devices/import-csv", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.success) {
        let msg = `Importación exitosa: ${data.createdCount} creados, ${data.updatedCount} actualizados.`;
        if (data.errors && data.errors.length > 0) {
          msg += ` Advertencias: ${data.errors.join(" | ")}`;
        }
        setSuccess(msg);
        fetchData();
      }
    } catch (err: any) {
      console.error("CSV import error:", err);
      setError(
        err.response?.data?.message || "Error al importar el archivo CSV.",
      );
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleLinkSim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    try {
      setError(null);
      setSuccess(null);
      await api.patch(`/devices/${selectedDevice.id}/link-sim`, {
        simCardId: selectedSimId || null,
      });
      setSuccess(`Enlace de SIM actualizado para el dispositivo.`);
      setIsLinkSimModalOpen(false);
      setSelectedDevice(null);
      setSelectedSimId("");
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Error al vincular SIM.");
    }
  };

  const handleLinkVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    try {
      setError(null);
      setSuccess(null);
      await api.patch(`/devices/${selectedDevice.id}/link-vehicle`, {
        vehicleId: selectedVehicleId || null,
      });
      setSuccess(`Enlace de vehículo actualizado para el dispositivo.`);
      setIsLinkVehicleModalOpen(false);
      setSelectedDevice(null);
      setSelectedVehicleId("");
      fetchData();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Error al vincular vehículo.");
    }
  };

  const openLinkSimModal = (device: any) => {
    setSelectedDevice(device);
    setSelectedSimId(device.simCardId || "");
    setIsLinkSimModalOpen(true);
  };

  const openLinkVehicleModal = (device: any) => {
    setSelectedDevice(device);
    setSelectedVehicleId(device.vehicleId || "");
    setIsLinkVehicleModalOpen(true);
  };

  // Filter lists of available options
  const availableSims = simCards.filter(
    (sim) => !sim.device || sim.device.id === selectedDevice?.id,
  );

  const availableVehicles = vehicles.filter(
    (v) => !v.device || v.device.id === selectedDevice?.id,
  );

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-base-content/50 tracking-wider">
              Total Dispositivos
            </span>
            <p className="text-2xl font-black text-base-content mt-1">
              {devices.length}
            </p>
          </div>
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Cpu className="size-6" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-base-content/50 tracking-wider">
              Dispositivos Activos
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {devices.filter((d) => d.status === "ACTIVE").length}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
            <CheckCircle className="size-6" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-base-content/50 tracking-wider">
              Total Tarjetas SIM
            </span>
            <p className="text-2xl font-black text-base-content mt-1">
              {simCards.length}
            </p>
          </div>
          <div className="p-3 bg-teal-500/10 rounded-2xl text-teal-600">
            <Radio className="size-6" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-base-content/50 tracking-wider">
              Origen Teltonika FOTA
            </span>
            <p className="text-2xl font-black text-indigo-600 mt-1">
              {devices.filter((d) => d.source === "FOTA").length}
            </p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600">
            <TrendingUp className="size-6" />
          </div>
        </div>
      </div>

      {/* Main control banner */}
      <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
            <Layers className="text-primary size-5" />
            Inventario Global de Hardware
          </h2>
          <p className="text-xs text-base-content/60 max-w-xl">
            Gestiona la asignación física de trackers Teltonika, asócialos con
            tarjetas SIM del proveedor y vincula dispositivos con los vehículos
            correspondientes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleCsvImport}
            style={{ display: "none" }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            isLoading={importing}
            leftIcon={<UploadCloud className="size-4" />}
            className="border-primary/20 hover:bg-primary/5 text-primary text-xs"
          >
            Importar CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncFota}
            isLoading={syncing}
            leftIcon={<RotateCw className="size-4 animate-infinite" />}
            className="border-primary/20 hover:bg-primary/5 text-primary text-xs"
          >
            Sincronizar FOTA Web
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsDeviceModalOpen(true)}
            leftIcon={<PlusCircle className="size-4" />}
            className="text-xs"
          >
            Agregar Dispositivo
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsSimModalOpen(true)}
            leftIcon={<PlusCircle className="size-4" />}
            className="text-xs"
          >
            Agregar SIM
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" message={error} />}
      {success && <Alert variant="success" message={success} />}

      {/* Table tabs */}
      <div className="tabs tabs-boxed bg-base-200/50 backdrop-blur-sm p-1.5 rounded-2xl w-fit border border-base-300/30">
        <button
          className={`tab tab-lg rounded-xl font-bold transition-all duration-200 ${
            subTab === "devices"
              ? "tab-active bg-base-100 text-base-content shadow-sm"
              : "text-base-content/60"
          }`}
          onClick={() => setSubTab("devices")}
        >
          Dispositivos GPS
        </button>
        <button
          className={`tab tab-lg rounded-xl font-bold transition-all duration-200 ${
            subTab === "sim-cards"
              ? "tab-active bg-base-100 text-base-content shadow-sm"
              : "text-base-content/60"
          }`}
          onClick={() => setSubTab("sim-cards")}
        >
          Tarjetas SIM
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-xs text-base-content/60">
            Cargando datos del inventario...
          </p>
        </div>
      ) : subTab === "devices" ? (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full text-xs">
              <thead>
                <tr>
                  <th className="font-bold text-base-content/70">IMEI</th>
                  <th className="font-bold text-base-content/70">Modelo</th>
                  <th className="font-bold text-base-content/70">Estado</th>
                  <th className="font-bold text-base-content/70">Origen</th>
                  <th className="font-bold text-base-content/70">Firmware</th>
                  <th className="font-bold text-base-content/70">SIM Card</th>
                  <th className="font-bold text-base-content/70">
                    Vehículo Vinculado
                  </th>
                  <th className="font-bold text-base-content/70 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-8 text-base-content/40"
                    >
                      No hay dispositivos registrados en el sistema. Sincroniza
                      con FOTA Web o agrega uno manualmente.
                    </td>
                  </tr>
                ) : (
                  devices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-base-200/40">
                      <td className="font-mono font-bold text-base-content/80">
                        {dev.imei}
                      </td>
                      <td>
                        <Badge
                          variant="ghost"
                          className="font-bold text-xs bg-primary/5 text-primary border-primary/20"
                        >
                          {dev.model}
                        </Badge>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm font-bold ${
                            dev.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                              : "bg-base-300 text-base-content/60 border-base-400"
                          }`}
                        >
                          {dev.status === "ACTIVE" ? "Activo" : "No Asignado"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm font-bold ${
                            dev.source === "FOTA"
                              ? "bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
                              : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                          }`}
                        >
                          {dev.source === "FOTA" ? "FOTA Web" : "Manual"}
                        </span>
                      </td>
                      <td className="font-mono text-base-content/60">
                        {dev.firmware || "—"}
                      </td>
                      <td>
                        {dev.simCard ? (
                          <div className="flex items-center gap-1.5 text-base-content/80 font-mono">
                            <Signal className="size-3.5 text-emerald-500" />
                            <span>{dev.simCard.iccid}</span>
                          </div>
                        ) : (
                          <span className="text-base-content/40 italic">
                            Sin SIM
                          </span>
                        )}
                      </td>
                      <td>
                        {dev.vehicle ? (
                          <div className="flex items-center gap-1.5 font-bold text-primary">
                            <span>{dev.vehicle.plateNumber}</span>
                            <span className="text-[10px] text-base-content/40 font-normal">
                              ({dev.vehicle.alias || "Sin alias"})
                            </span>
                          </div>
                        ) : (
                          <span className="text-base-content/40 italic">
                            Sin Vehículo
                          </span>
                        )}
                      </td>
                      <td className="text-right space-x-1.5">
                        <button
                          onClick={() => openLinkSimModal(dev)}
                          className="btn btn-xs btn-ghost text-teal-600 hover:bg-teal-500/10"
                          title="Vincular Tarjeta SIM"
                        >
                          <Signal className="size-3.5" />
                          <span>SIM</span>
                        </button>
                        <button
                          onClick={() => openLinkVehicleModal(dev)}
                          className="btn btn-xs btn-ghost text-primary hover:bg-primary/10"
                          title="Vincular Vehículo"
                        >
                          <Link2 className="size-3.5" />
                          <span>Vehículo</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full text-xs">
              <thead>
                <tr>
                  <th className="font-bold text-base-content/70">ICCID</th>
                  <th className="font-bold text-base-content/70">
                    Número Telefónico
                  </th>
                  <th className="font-bold text-base-content/70">Operador</th>
                  <th className="font-bold text-base-content/70">
                    Dispositivo Asociado
                  </th>
                  <th className="font-bold text-base-content/70">
                    Vehículo Vinculado
                  </th>
                  <th className="font-bold text-base-content/70">
                    Fecha de Creación
                  </th>
                </tr>
              </thead>
              <tbody>
                {simCards.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-8 text-base-content/40"
                    >
                      No hay tarjetas SIM registradas en el sistema. Agrega una
                      manualmente.
                    </td>
                  </tr>
                ) : (
                  simCards.map((sim) => (
                    <tr key={sim.id} className="hover:bg-base-200/40">
                      <td className="font-mono font-bold text-base-content/80">
                        {sim.iccid}
                      </td>
                      <td className="font-mono text-base-content/70">
                        {sim.phoneNumber || "—"}
                      </td>
                      <td>
                        <span className="badge badge-sm badge-outline font-bold text-[10px]">
                          {sim.carrier || "No especificado"}
                        </span>
                      </td>
                      <td>
                        {sim.device ? (
                          <div className="flex items-center gap-1 text-base-content/80 font-mono">
                            <Cpu className="size-3.5 text-primary" />
                            <span>{sim.device.imei}</span>
                            <span className="text-[10px] text-base-content/40">
                              ({sim.device.model})
                            </span>
                          </div>
                        ) : (
                          <span className="text-base-content/40 italic">
                            Disponible
                          </span>
                        )}
                      </td>
                      <td>
                        {sim.device?.vehicle ? (
                          <div className="font-bold text-primary">
                            {sim.device.vehicle.plateNumber}
                          </div>
                        ) : (
                          <span className="text-base-content/40 italic">—</span>
                        )}
                      </td>
                      <td className="text-base-content/50">
                        {new Date(sim.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR DISPOSITIVO */}
      <Modal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        title="Registrar Dispositivo GPS"
        subtitle="Agrega un dispositivo tracker GPS al inventario local manualmente."
      >
        <form onSubmit={handleCreateDevice} className="space-y-4 pt-2">
          <Input
            label="IMEI (15 dígitos)"
            placeholder="Ej. 863242045551001"
            required
            type="text"
            maxLength={15}
            className="font-mono"
            value={newDevice.imei}
            onChange={(e) =>
              setNewDevice({
                ...newDevice,
                imei: e.target.value.replace(/\D/g, ""),
              })
            }
          />
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs text-base-content/85">
                Modelo del Dispositivo
              </span>
            </label>
            <select
              className="select select-bordered w-full text-sm"
              value={newDevice.model}
              onChange={(e) =>
                setNewDevice({ ...newDevice, model: e.target.value })
              }
            >
              <option value="FMC003">FMC003 (OBDII Standard)</option>
              <option value="FMC150">FMC150 (Special Tracker CAN)</option>
              <option value="FMC650">FMC650 (Professional Heavy-Duty)</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeviceModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Registrar
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTRAR TARJETA SIM */}
      <Modal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        title="Registrar Tarjeta SIM"
        subtitle="Registra una nueva tarjeta SIM del proveedor en el inventario."
      >
        <form onSubmit={handleCreateSim} className="space-y-4 pt-2">
          <Input
            label="ICCID (19-20 dígitos)"
            placeholder="Ej. 8950740000000000001"
            required
            type="text"
            maxLength={20}
            className="font-mono"
            value={newSim.iccid}
            onChange={(e) =>
              setNewSim({ ...newSim, iccid: e.target.value.replace(/\D/g, "") })
            }
          />
          <Input
            label="Número Telefónico (Opcional)"
            placeholder="Ej. +507 6000-1234"
            type="text"
            value={newSim.phoneNumber}
            onChange={(e) =>
              setNewSim({ ...newSim, phoneNumber: e.target.value })
            }
          />
          <Input
            label="Proveedor / Carrier (Opcional)"
            placeholder="Ej. Tigo, +Movil, Claro"
            type="text"
            value={newSim.carrier}
            onChange={(e) => setNewSim({ ...newSim, carrier: e.target.value })}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSimModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Registrar
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VINCULAR TARJETA SIM */}
      <Modal
        isOpen={isLinkSimModalOpen}
        onClose={() => {
          setIsLinkSimModalOpen(false);
          setSelectedDevice(null);
        }}
        title="Vincular Tarjeta SIM"
        subtitle={`Vincular una tarjeta SIM al dispositivo IMEI ${selectedDevice?.imei}.`}
      >
        <form onSubmit={handleLinkSim} className="space-y-4 pt-2">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs text-base-content/85">
                Selecciona Tarjeta SIM
              </span>
            </label>
            <select
              className="select select-bordered w-full font-mono text-sm"
              value={selectedSimId}
              onChange={(e) => setSelectedSimId(e.target.value)}
            >
              <option value="">Ninguna (Desvincular)</option>
              {availableSims.map((sim) => (
                <option key={sim.id} value={sim.id}>
                  ICCID: {sim.iccid}{" "}
                  {sim.phoneNumber ? `(${sim.phoneNumber})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsLinkSimModalOpen(false);
                setSelectedDevice(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VINCULAR VEHÍCULO */}
      <Modal
        isOpen={isLinkVehicleModalOpen}
        onClose={() => {
          setIsLinkVehicleModalOpen(false);
          setSelectedDevice(null);
        }}
        title="Vincular Vehículo"
        subtitle={`Vincular un vehículo al dispositivo IMEI ${selectedDevice?.imei}.`}
      >
        <form onSubmit={handleLinkVehicle} className="space-y-4 pt-2">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs text-base-content/85">
                Selecciona Vehículo
              </span>
            </label>
            <select
              className="select select-bordered w-full text-sm font-semibold"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
            >
              <option value="">Ninguno (Desvincular)</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} — {v.alias || "Sin alias"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsLinkVehicleModalOpen(false);
                setSelectedDevice(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
