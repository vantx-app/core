"use client";

import React, { useState, useEffect, useCallback } from "react";
import api from "../utils/client/api-client";
import {
  FileText,
  ShieldCheck,
  XCircle,
  CheckCircle,
  Loader2,
  Eye,
  AlertTriangle,
  User,
} from "lucide-react";

export interface PendingDocument {
  id: string;
  driverId: string;
  type: string;
  status: string;
  fileKey: string;
  fileUrl?: string | null;
  extractedData?: {
    scanMethod?: string;
    matchedNationalId?: boolean;
    matchedName?: boolean;
    extractedTextSnippet?: string;
    verificationFailureReason?: string;
    workerError?: string;
    diditSessionId?: string;
    diditUrl?: string;
    expirationDate?: string;
    diditDecision?: {
      status: string;
      id_verifications?: {
        status: string;
        document_type?: string;
        expiration_date?: string;
        extra_fields?: {
          dl_categories?: string;
          [key: string]: string | undefined;
        };
      }[];
      simulated?: boolean;
    } | null;
  } | null;
  createdAt: string;
  driver: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    nationalId: string;
  };
}

export function AdminDocumentsReviewTab() {
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PendingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPendingDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<PendingDocument[]>(
        "/documents/admin/pending",
      );
      setPendingDocs(data);
      if (data.length > 0) {
        setSelectedDoc(data[0]);
      } else {
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error("Error al cargar documentos pendientes:", err);
      setError("No se pudieron cargar los documentos pendientes de revisión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingDocs();
  }, [fetchPendingDocs]);

  const handleReview = async (
    docId: string,
    status: "APPROVED" | "REJECTED",
  ) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.post(`/documents/admin/${docId}/review`, { status });
      setSuccessMsg(
        status === "APPROVED"
          ? "El documento ha sido aprobado y el archivo original fue eliminado de S3."
          : "El documento ha sido rechazado. Se notificará al conductor.",
      );

      // Eliminar el documento de la lista local
      const updatedList = pendingDocs.filter((d) => d.id !== docId);
      setPendingDocs(updatedList);
      if (updatedList.length > 0) {
        setSelectedDoc(updatedList[0]);
      } else {
        setSelectedDoc(null);
      }
    } catch (err: any) {
      console.error("Error al revisar documento:", err);
      setError(
        err.response?.data?.message || "Error al procesar la revisión manual.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const getDocTypeName = (type: string) => {
    switch (type) {
      case "NATIONAL_ID":
        return "Cédula de Identidad (National ID)";
      case "DRIVERS_LICENSE":
        return "Licencia de Conducir";
      case "POLICE_RECORD":
        return "Historial Policivo (Record Policivo)";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-100 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-950 flex items-center gap-2">
            <ShieldCheck className="text-blue-600 size-6" />
            Revisión Manual de Documentos
          </h1>
          <p className="text-slate-650 text-xs mt-1 leading-relaxed">
            Compara los documentos subidos por los conductores contra los
            registros de la base de datos para aprobarlos o rechazarlos de forma
            manual.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert bg-red-50 text-red-800 border border-red-200 p-4 rounded-xl text-xs font-semibold shadow-sm flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-semibold shadow-sm flex items-start gap-2">
          <CheckCircle className="size-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Loader2 className="size-10 animate-spin text-blue-600" />
          <p className="text-slate-500 text-xs font-medium">
            Cargando revisiones pendientes...
          </p>
        </div>
      ) : pendingDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm py-20">
          <CheckCircle className="size-16 text-emerald-500 mb-4 animate-pulse" />
          <h3 className="text-base font-extrabold text-slate-950">
            ¡Todo al día!
          </h3>
          <p className="text-slate-500 text-xs max-w-sm mt-1 leading-relaxed">
            No hay ningún documento pendiente de revisión manual en este
            momento. Todos han sido validados automáticamente o resueltos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* List Section (Left column on large screens) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 p-4 rounded-2xl space-y-4 max-h-[75vh] overflow-y-auto shadow-sm">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 px-2">
              Pendientes ({pendingDocs.length})
            </h3>
            <div className="space-y-2">
              {pendingDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                const driverName =
                  `${doc.driver.firstName ?? ""} ${doc.driver.lastName ?? ""}`.trim() ||
                  doc.driver.nationalId;

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 text-blue-900"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <div className="font-extrabold text-sm line-clamp-1">
                      {driverName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <FileText className="size-3.5" />
                      {getDocTypeName(doc.type)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 font-mono">
                      Subido: {new Date(doc.createdAt).toLocaleString("es-ES")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Detail View Section (Right column on large screens) */}
          {selectedDoc && (
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Document Preview (Left half of detail view) */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between min-h-[50vh] shadow-sm">
                <div className="space-y-3 flex-1 flex flex-col justify-between">
                  <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Eye className="size-4 text-blue-600" /> Vista del Documento
                  </h3>

                  <div className="bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 p-4 flex-1 my-2 min-h-[300px]">
                    {selectedDoc.fileUrl ? (
                      selectedDoc.fileKey.toLowerCase().endsWith(".pdf") ? (
                        <iframe
                          src={`${selectedDoc.fileUrl}#toolbar=0`}
                          className="w-full h-[350px] border-none"
                          title="Visor PDF"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedDoc.fileUrl}
                          alt="Documento Conductor"
                          className="max-h-[350px] max-w-full object-contain rounded-lg shadow-sm"
                        />
                      )
                    ) : selectedDoc.extractedData?.diditUrl ? (
                      <div className="text-center p-6 space-y-4 flex flex-col items-center justify-center h-full min-h-[300px]">
                        <ShieldCheck className="size-12 text-blue-600 animate-pulse" />
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-slate-900">
                            Verificación vía Didit
                          </p>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto">
                            Este documento se validó de forma externa. Puedes
                            abrir la sesión de verificación para revisar las
                            capturas y selfies.
                          </p>
                        </div>
                        <a
                          href={selectedDoc.extractedData.diditUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all duration-200"
                        >
                          Abrir sesión en Didit
                        </a>
                      </div>
                    ) : (
                      <div className="text-center p-6 text-slate-400 text-xs italic">
                        No se pudo cargar el enlace de visualización.
                      </div>
                    )}
                  </div>

                  {selectedDoc.fileUrl && (
                    <a
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all duration-200"
                    >
                      Abrir en pestaña nueva
                    </a>
                  )}

                  {selectedDoc.extractedData?.diditUrl &&
                    !selectedDoc.fileUrl && (
                      <a
                        href={selectedDoc.extractedData.diditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-center py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold transition-all duration-200"
                      >
                        Abrir verificación en Didit
                      </a>
                    )}
                </div>
              </div>

              {/* Data Matching & Actions (Right half of detail view) */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <div className="space-y-4">
                  <h3 className="font-extrabold text-xs text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <User className="size-4 text-blue-600" /> Datos de
                    Verificación
                  </h3>

                  {/* Driver data in DB */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
                      Datos Registrados en BD
                    </h4>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-550">Conductor:</span>
                        <span className="font-extrabold text-slate-950">
                          {selectedDoc.driver.firstName}{" "}
                          {selectedDoc.driver.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-550">Cédula:</span>
                        <span className="font-mono font-extrabold text-slate-950">
                          {selectedDoc.driver.nationalId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-matching findings */}
                  {selectedDoc.extractedData?.diditSessionId ? (
                    <div className="space-y-2">
                      <h4 className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
                        Resultado de Verificación Didit
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span>Estado de la Decisión:</span>
                          <span
                            className={`badge font-bold px-2 py-0.5 text-[10px] rounded-full border ${
                              selectedDoc.extractedData?.diditDecision
                                ?.status === "Approved"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : selectedDoc.extractedData?.diditDecision
                                      ?.status === "In Review"
                                  ? "bg-amber-50 text-amber-850 border-amber-200"
                                  : "bg-red-50 text-red-800 border-red-200"
                            }`}
                          >
                            {selectedDoc.extractedData?.diditDecision?.status ||
                              "Pendiente"}
                          </span>
                        </div>
                        {selectedDoc.extractedData?.expirationDate && (
                          <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span>Fecha de Expiración:</span>
                            <span className="font-extrabold text-slate-950 text-[11px]">
                              {selectedDoc.extractedData.expirationDate}
                            </span>
                          </div>
                        )}
                        {selectedDoc.extractedData?.diditDecision
                          ?.id_verifications?.[0]?.document_type && (
                          <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                            <span>Tipo de Documento:</span>
                            <span className="font-extrabold text-slate-950 text-[11px]">
                              {
                                selectedDoc.extractedData.diditDecision
                                  .id_verifications[0].document_type
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
                        Resultados Escaneo Automático
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span>Coincidencia de Cédula:</span>
                          <span
                            className={`badge font-bold px-2 py-0.5 text-[10px] rounded-full border ${
                              selectedDoc.extractedData?.matchedNationalId
                                ? "bg-emerald-50 text-emerald-850 border-emerald-200"
                                : "bg-red-50 text-red-850 border-red-200"
                            }`}
                          >
                            {selectedDoc.extractedData?.matchedNationalId
                              ? "Coincide"
                              : "No Coincide"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span>Coincidencia de Nombre:</span>
                          <span
                            className={`badge font-bold px-2 py-0.5 text-[10px] rounded-full border ${
                              selectedDoc.extractedData?.matchedName
                                ? "bg-emerald-50 text-emerald-850 border-emerald-200"
                                : "bg-red-50 text-red-850 border-red-200"
                            }`}
                          >
                            {selectedDoc.extractedData?.matchedName
                              ? "Coincide"
                              : "No Coincide"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OCR snippet extracted */}
                  {selectedDoc.extractedData?.extractedTextSnippet && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-[10px] uppercase tracking-wider text-slate-400">
                        Texto Extraído (OCR)
                      </h4>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10px] font-mono leading-normal max-h-[120px] overflow-y-auto text-slate-700 text-left">
                        {selectedDoc.extractedData.extractedTextSnippet}
                      </div>
                    </div>
                  )}

                  {selectedDoc.extractedData?.workerError && (
                    <div className="alert bg-amber-50 text-amber-800 border border-amber-250 p-2.5 rounded-xl text-[10px] flex items-center gap-1.5 text-left">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>
                        Fallo de procesamiento:{" "}
                        {selectedDoc.extractedData.workerError}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
                  <button
                    onClick={() => handleReview(selectedDoc.id, "REJECTED")}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-650 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    disabled={actionLoading}
                  >
                    <XCircle className="size-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleReview(selectedDoc.id, "APPROVED")}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="size-4 animate-spin text-white" />
                    ) : (
                      <CheckCircle className="size-4" />
                    )}
                    Aprobar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
