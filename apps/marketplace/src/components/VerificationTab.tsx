"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import api from "../utils/client/api-client";
import {
  FileText,
  ShieldCheck,
  UploadCloud,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  getDriverDocStatusBadgeClass,
  getDriverDocStatusText,
} from "../utils/client/format";

export interface DriverDocument {
  id: string;
  driverId: string;
  type: string;
  status: string;
  fileKey: string | null;
  fileUrl?: string | null;
  extractedData?: {
    verificationFailureReason?: string;
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
        };
      }[];
    };
  } | null;
}

export interface VerificationTabProps {
  onSync?: () => void;
}

export function VerificationTab({ onSync }: VerificationTabProps) {
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/documents/me");
      setDocuments(data);
    } catch (err) {
      console.error("Error al cargar documentos:", err);
      setError("No se pudieron cargar los documentos de verificación.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const getDocStatus = (type: string) => {
    const doc = documents.find((d) => d.type === type);
    return doc?.status || "PENDING_UPLOAD";
  };

  const getDocFileUrl = (type: string) => {
    const doc = documents.find((d) => d.type === type);
    return doc?.fileUrl;
  };

  const getDocExtractedData = (type: string) => {
    const doc = documents.find((d) => d.type === type);
    return doc?.extractedData;
  };

  const handleUpload = async (type: string, file: File) => {
    setUploadingDoc(type);
    setError(null);

    try {
      // 1. Obtener la URL firmada para la subida
      const { data: uploadData } = await api.post("/documents/me/upload-url", {
        type,
        contentType: file.type,
      });

      const { uploadUrl } = uploadData;

      // 2. Subir directamente a S3
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
        },
      });

      // 3. Notificar al backend para que inicie la verificación
      await api.post("/documents/me/verify", { type });

      // 4. Polling para actualizar el estado tras la verificación
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const { data } = await api.get("/documents/me");
          setDocuments(data);
          const currentDoc = data.find((d: DriverDocument) => d.type === type);
          if (currentDoc && currentDoc.status !== "PENDING_VALIDATION") {
            clearInterval(interval);
            setUploadingDoc(null);
            if (currentDoc.status === "APPROVED") {
              onSync?.();
            }
          }
        } catch (pollErr) {
          console.error("Error durante polling:", pollErr);
        }

        if (attempts >= 8) {
          clearInterval(interval);
          setUploadingDoc(null);
        }
      }, 3000);
    } catch (err: unknown) {
      console.error("Error en la subida del documento:", err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg =
        axiosErr.response?.data?.message || "Error al subir el archivo.";
      setError(errMsg);
      setUploadingDoc(null);
    }
  };

  const handleDiditVerify = async (type: string) => {
    setUploadingDoc(type);
    setError(null);

    try {
      // 1. Obtener la sesión de Didit
      const { data } = await api.post("/documents/me/didit-session", { type });
      const { url } = data;

      // 2. Abrir la URL en una nueva pestaña
      window.open(url, "_blank");

      // 3. Polling para actualizar el estado tras la verificación
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const { data: docsData } = await api.get("/documents/me");
          setDocuments(docsData);
          const currentDoc = docsData.find(
            (d: DriverDocument) => d.type === type,
          );
          if (currentDoc && currentDoc.status !== "PENDING_VALIDATION") {
            clearInterval(interval);
            setUploadingDoc(null);
            if (currentDoc.status === "APPROVED") {
              onSync?.();
            }
          }
        } catch (pollErr) {
          console.error("Error durante polling de Didit:", pollErr);
        }

        if (attempts >= 40) {
          clearInterval(interval);
          setUploadingDoc(null);
        }
      }, 3000);
    } catch (err: unknown) {
      console.error("Error al iniciar la verificación de Didit:", err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg =
        axiosErr.response?.data?.message || "Error al iniciar la verificación.";
      setError(errMsg);
      setUploadingDoc(null);
    }
  };

  const documentTypes = [
    {
      type: "NATIONAL_ID",
      title: "Cédula de Identidad Personal (National ID)",
      desc: "Documento nacional de identidad para verificación del conductor.",
    },
    {
      type: "DRIVERS_LICENSE",
      title: "Licencia de Conducir",
      desc: "Licencia vigente del conductor que coincida con su tipo de vehículo.",
    },
    {
      type: "POLICE_RECORD",
      title: "Historial Policivo (Record Policivo)",
      desc: "Certificado oficial de antecedentes policiales no mayor a 30 días.",
    },
  ];

  if (loading) {
    return (
      <div className="card bg-white border border-slate-200 shadow-md rounded-2xl w-full">
        <div className="card-body p-8 flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <p className="text-xs text-slate-500 mt-2">
            Cargando documentos de verificación...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-white border border-slate-200 shadow-sm rounded-2xl w-full">
      <div className="card-body p-6 space-y-6">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <ShieldCheck className="size-5" />
            </span>
            Validación de Documentos Requeridos
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Sube tus documentos para habilitar tu perfil en la plataforma y
            poder ver los detalles de los vehículos. Se realiza verificación
            OCR/QR instantánea.
          </p>
        </div>

        {error && (
          <div className="alert alert-error shadow p-3 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-white" />
            <span className="text-white">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {documentTypes.map((docType) => {
            const status = getDocStatus(docType.type);
            const fileUrl = getDocFileUrl(docType.type);
            const isUploading = uploadingDoc === docType.type;
            const extracted = getDocExtractedData(docType.type);

            return (
              <div
                key={docType.type}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-200 text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0 mt-0.5">
                    <FileText className="size-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 tracking-tight">
                      {docType.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed truncate">
                      {docType.desc}
                    </p>
                    {extracted?.verificationFailureReason && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1">
                        Motivo revisión: {extracted.verificationFailureReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto sm:self-auto shrink-0 mt-2 sm:mt-0">
                  <span
                    className={`badge text-xs font-semibold rounded-full border px-2 py-0.5 ${getDriverDocStatusBadgeClass(status)}`}
                  >
                    {isUploading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" />
                        Procesando...
                      </span>
                    ) : (
                      getDriverDocStatusText(status)
                    )}
                  </span>

                  {status === "PENDING_VALIDATION" && extracted?.diditUrl && (
                    <a
                      href={extracted.diditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold transition-all"
                    >
                      Continuar
                    </a>
                  )}

                  {(status === "PENDING_UPLOAD" || status === "REJECTED") &&
                    (docType.type === "POLICE_RECORD" ? (
                      <label className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-sm flex items-center gap-1">
                        <UploadCloud className="size-4" />
                        Subir
                        <input
                          type="file"
                          accept="image/png, image/jpeg, application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(docType.type, file);
                          }}
                          disabled={isUploading}
                        />
                      </label>
                    ) : (
                      <button
                        onClick={() => handleDiditVerify(docType.type)}
                        disabled={isUploading}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all shadow-sm flex items-center gap-1"
                      >
                        <ShieldCheck className="size-4" />
                        Verificar
                      </button>
                    ))}

                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      <Eye className="size-4" />
                      Ver
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
