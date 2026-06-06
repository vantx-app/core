import { DriverDocument, DriverDocumentsCardProps, DriverDocumentsStats } from '@/types';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '@/utils/client/api-client';
import {
  FileText,
  ShieldCheck,
  UploadCloud,
  Eye,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  getDriverDocStatusBadgeClass,
  getDriverDocStatusText,
} from '@/utils/client';

export function DriverDocumentsCard({ driverStats, onSync }: DriverDocumentsCardProps) {
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/documents/me');
      setDocuments(data);
    } catch (err) {
      console.error('Error al cargar documentos:', err);
      setError('No se pudieron cargar los documentos de verificación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const getDocStatus = (type: string) => {
    const doc = documents.find((d) => d.type === type);
    return doc?.status || 'PENDING_UPLOAD';
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
      const { data: uploadData } = await api.post('/documents/me/upload-url', {
        type,
        contentType: file.type,
      });

      const { uploadUrl } = uploadData;

      // 2. Subir directamente a S3
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
      });

      // 3. Notificar al backend para que inicie la verificación
      await api.post('/documents/me/verify', { type });

      // 4. Polling para actualizar el estado tras la verificación
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const { data } = await api.get('/documents/me');
          setDocuments(data);
          const currentDoc = data.find((d: DriverDocument) => d.type === type);
          if (currentDoc && currentDoc.status !== 'PENDING_VALIDATION') {
            clearInterval(interval);
            setUploadingDoc(null);
            if (currentDoc.status === 'APPROVED') {
              onSync?.();
            }
          }
        } catch (pollErr) {
          console.error('Error durante polling:', pollErr);
        }

        if (attempts >= 8) {
          clearInterval(interval);
          setUploadingDoc(null);
        }
      }, 3000);

    } catch (err: unknown) {
      console.error('Error en la subida del documento:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosErr.response?.data?.message || 'Error al subir el archivo.';
      setError(errMsg);
      setUploadingDoc(null);
    }
  };

  const handleDiditVerify = async (type: string) => {
    setUploadingDoc(type);
    setError(null);

    try {
      // 1. Obtener la sesión de Didit
      const { data } = await api.post('/documents/me/didit-session', { type });
      const { url } = data;

      // 2. Abrir la URL en una nueva pestaña
      window.open(url, '_blank');

      // 3. Polling para actualizar el estado tras la verificación
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const { data: docsData } = await api.get('/documents/me');
          setDocuments(docsData);
          const currentDoc = docsData.find((d: DriverDocument) => d.type === type);
          if (currentDoc && currentDoc.status !== 'PENDING_VALIDATION') {
            clearInterval(interval);
            setUploadingDoc(null);
            if (currentDoc.status === 'APPROVED') {
              onSync?.();
            }
          }
        } catch (pollErr) {
          console.error('Error durante polling de Didit:', pollErr);
        }

        if (attempts >= 40) {
          clearInterval(interval);
          setUploadingDoc(null);
        }
      }, 3000);

    } catch (err: unknown) {
      console.error('Error al iniciar la verificación de Didit:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosErr.response?.data?.message || 'Error al iniciar la verificación.';
      setError(errMsg);
      setUploadingDoc(null);
    }
  };

  const documentTypes = [
    {
      type: 'NATIONAL_ID',
      title: 'Cédula de Identidad Personal (National ID)',
      desc: 'Documento nacional de identidad para verificación del conductor.',
    },
    {
      type: 'DRIVERS_LICENSE',
      title: 'Licencia de Conducir',
      desc: 'Licencia vigente del conductor que coincida con su tipo de vehículo.',
    },
    {
      type: 'POLICE_RECORD',
      title: 'Historial Policivo (Record Policivo)',
      desc: 'Certificado oficial de antecedentes policiales no mayor a 30 días.',
    },
  ];

  if (loading) {
    return (
      <div className="card bg-base-100/30 backdrop-blur-md border border-base-200 shadow-xl rounded-2xl w-full">
        <div className="card-body p-6 flex flex-col items-center justify-center min-h-[200px]">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs text-base-content/50 mt-2">Cargando documentos de verificación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100/30 backdrop-blur-md border border-base-200 shadow-xl rounded-2xl w-full">
      <div className="card-body p-6 space-y-6">
        <div>
          <h3 className="font-extrabold text-lg text-base-content flex items-center gap-2">
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl shrink-0">
              <ShieldCheck className="size-5" />
            </span>
            Validación de Documentos Requeridos
          </h3>
          <p className="text-xs text-base-content/50 mt-1">
            Sube los documentos del conductor para habilitar el perfil en la flota. Se realiza verificación OCR/QR instantánea.
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
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-base-100/50 rounded-xl border border-base-200 hover:border-base-300 transition-all duration-200 text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-base-200 text-base-content/60 rounded-lg shrink-0 mt-0.5">
                    <FileText className="size-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="font-bold text-sm text-base-content tracking-tight">{docType.title}</h4>
                    <p className="text-xs text-base-content/50 leading-relaxed truncate">{docType.desc}</p>
                    {extracted?.verificationFailureReason && (
                      <p className="text-[10px] text-warning font-semibold mt-1">
                        Motivo revisión: {extracted.verificationFailureReason}
                      </p>
                    )}
                    {extracted?.diditDecision?.status === 'Declined' && (
                      <p className="text-[10px] text-error font-semibold mt-1">
                        Rechazado por Didit: El documento no es válido o no coincide.
                      </p>
                    )}
                    {extracted?.diditDecision?.status === 'Abandoned' && (
                      <p className="text-[10px] text-warning font-semibold mt-1">
                        Cancelado por el usuario en Didit.
                      </p>
                    )}
                    {status === 'APPROVED' && docType.type === 'DRIVERS_LICENSE' && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 space-y-0.5">
                        <p>Tipo de Licencia: <span className="font-bold text-emerald-700 dark:text-emerald-300">{driverStats?.licenseType || extracted?.diditDecision?.id_verifications?.[0]?.extra_fields?.dl_categories || 'N/A'}</span></p>
                        {extracted?.expirationDate && (
                          <p>Vence: <span className="font-bold text-emerald-700 dark:text-emerald-300">{extracted.expirationDate}</span></p>
                        )}
                      </div>
                    )}
                    {status === 'APPROVED' && docType.type === 'NATIONAL_ID' && extracted?.expirationDate && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                        <p>Vence: <span className="font-bold text-emerald-700 dark:text-emerald-300">{extracted.expirationDate}</span></p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  <span className={`badge border ${getDriverDocStatusBadgeClass(status)}`}>
                    {isUploading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" />
                        Procesando...
                      </span>
                    ) : (
                      getDriverDocStatusText(status)
                    )}
                  </span>

                  {status === 'PENDING_VALIDATION' && extracted?.diditUrl && (
                    <a
                      href={extracted.diditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-primary btn-sm rounded-xl text-xs font-semibold"
                    >
                      Continuar
                    </a>
                  )}

                  {(status === 'PENDING_UPLOAD' || status === 'REJECTED') && (
                    docType.type === 'POLICE_RECORD' ? (
                      <label className="btn btn-primary btn-sm rounded-xl cursor-pointer active:scale-95 transition-all text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-md">
                        <UploadCloud className="size-4 mr-1" />
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
                        className="btn btn-primary btn-sm rounded-xl active:scale-95 transition-all text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-md"
                      >
                        <ShieldCheck className="size-4 mr-1" />
                        Verificar
                      </button>
                    )
                  )}

                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm rounded-xl text-xs font-semibold"
                    >
                      <Eye className="size-4 mr-1" />
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
