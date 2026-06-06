'use client';

import { PendingDocument } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import api from '@/utils/client/api-client';
import {
  FileText,
  ShieldCheck,
  XCircle,
  CheckCircle,
  Loader2,
  Eye,
  AlertTriangle,
  User,
} from 'lucide-react';

export default function PendingDocumentsReviewPage() {
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PendingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPendingDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/documents/admin/pending');
      setPendingDocs(data);
      if (data.length > 0) {
        setSelectedDoc(data[0]);
      } else {
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error('Error al cargar documentos pendientes:', err);
      setError('No se pudieron cargar los documentos pendientes de revisión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingDocs();
  }, [fetchPendingDocs]);

  const handleReview = async (docId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.post(`/documents/admin/${docId}/review`, { status });
      setSuccessMsg(
        status === 'APPROVED'
          ? 'El documento ha sido aprobado y el archivo original fue eliminado de S3.'
          : 'El documento ha sido rechazado. Se notificará al conductor.',
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
      console.error('Error al revisar documento:', err);
      setError(
        err.response?.data?.message || 'Error al procesar la revisión manual.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const getDocTypeName = (type: string) => {
    switch (type) {
      case 'NATIONAL_ID':
        return 'Cédula de Identidad (National ID)';
      case 'DRIVERS_LICENSE':
        return 'Licencia de Conducir';
      case 'POLICE_RECORD':
        return 'Historial Policivo (Record Policivo)';
      default:
        return type;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <BackButton
          fallbackHref="/admin"
        >
          Volver a administración
        </BackButton>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100/50 backdrop-blur-md p-6 rounded-2xl border border-base-200">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-primary size-7" />
            Revisión Manual de Documentos
          </h1>
          <p className="text-base-content/60 text-sm mt-0.5">
            Compara los documentos subidos por los conductores contra los registros de la base de datos para aprobarlos o rechazarlos.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error shadow-lg">
          <AlertTriangle className="size-5 text-white" />
          <span className="text-white">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success shadow-lg">
          <CheckCircle className="size-5 text-white" />
          <span className="text-white">{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-base-content/60 text-sm">Cargando revisiones pendientes...</p>
        </div>
      ) : pendingDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-base-100/30 rounded-2xl border border-dashed border-base-300 py-20">
          <CheckCircle className="size-16 text-emerald-500 mb-4 animate-bounce" />
          <h3 className="text-lg font-bold">¡Todo al día!</h3>
          <p className="text-base-content/50 text-sm max-w-sm mt-1">
            No hay ningún documento pendiente de revisión manual en este momento. Todos han sido validados automáticamente o resueltos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* List Section (Left column on large screens) */}
          <div className="lg:col-span-4 card bg-base-100/50 border border-base-200 p-4 rounded-2xl space-y-4 max-h-[75vh] overflow-y-auto">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-base-content/40 px-2">Pendientes ({pendingDocs.length})</h3>
            <div className="space-y-2">
              {pendingDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                const driverName = `${doc.driver.firstName ?? ''} ${doc.driver.lastName ?? ''}`.trim() || doc.driver.nationalId;
                
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary-content'
                        : 'bg-base-100 border-base-200 hover:border-base-300 text-base-content'
                    }`}
                  >
                    <div className="font-bold text-sm line-clamp-1">{driverName}</div>
                    <div className="text-xs text-base-content/60 mt-1 flex items-center gap-1">
                      <FileText className="size-3.5" />
                      {getDocTypeName(doc.type)}
                    </div>
                    <div className="text-[10px] text-base-content/45 mt-2 font-mono">
                      Subido: {new Date(doc.createdAt).toLocaleString('es-ES')}
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
              <div className="card bg-base-100 border border-base-200 p-4 rounded-2xl flex flex-col justify-between min-h-[50vh]">
                <div className="space-y-3 flex-1 flex flex-col justify-between">
                  <h3 className="font-bold text-sm text-base-content flex items-center gap-1.5 border-b border-base-200 pb-2">
                    <Eye className="size-4 text-primary" /> Vista del Documento
                  </h3>
                  
                  <div className="bg-base-200 rounded-xl overflow-hidden flex items-center justify-center border border-base-300/40 p-4 flex-1 my-2 min-h-[300px]">
                    {selectedDoc.fileUrl ? (
                      selectedDoc.fileKey.toLowerCase().endsWith('.pdf') ? (
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
                        <ShieldCheck className="size-12 text-primary animate-pulse" />
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-base-content">Verificación vía Didit</p>
                          <p className="text-xs text-base-content/50 max-w-xs mx-auto">
                            Este documento se validó de forma externa. Puedes abrir la sesión de verificación para revisar las capturas y selfies.
                          </p>
                        </div>
                        <a
                          href={selectedDoc.extractedData.diditUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-md"
                        >
                          Abrir sesión en Didit
                        </a>
                      </div>
                    ) : (
                      <div className="text-center p-6 text-base-content/50 text-xs italic">
                        No se pudo cargar el enlace de visualización.
                      </div>
                    )}
                  </div>

                  {selectedDoc.fileUrl && (
                    <a
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-xs w-full rounded-lg"
                    >
                      Abrir en pestaña nueva
                    </a>
                  )}

                  {selectedDoc.extractedData?.diditUrl && !selectedDoc.fileUrl && (
                    <a
                      href={selectedDoc.extractedData.diditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-xs w-full rounded-lg"
                    >
                      Abrir verificación en Didit
                    </a>
                  )}
                </div>
              </div>

              {/* Data Matching & Actions (Right half of detail view) */}
              <div className="card bg-base-100 border border-base-200 p-4 rounded-2xl flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-base-content border-b border-base-200 pb-2 flex items-center gap-1.5">
                    <User className="size-4 text-primary" /> Datos de Verificación
                  </h3>

                  {/* Driver data in DB */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/40">Datos Registrados en BD</h4>
                    <div className="bg-base-200/50 p-3 rounded-xl border border-base-300/45 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-base-content/50">Conductor:</span>
                        <span className="font-bold text-base-content">
                          {selectedDoc.driver.firstName} {selectedDoc.driver.lastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/50">Cédula:</span>
                        <span className="font-mono font-bold text-base-content">
                          {selectedDoc.driver.nationalId}
                        </span>
                      </div>
                    </div>
                  </div>

                   {/* Auto-matching findings */}
                  {selectedDoc.extractedData?.diditSessionId ? (
                    <div className="space-y-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/40">Resultado de Verificación Didit</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs p-2.5 bg-base-200/30 rounded-lg border border-base-200">
                          <span>Estado de la Decisión:</span>
                          <span
                            className={`badge font-bold px-2 py-0.5 text-[10px] ${
                              selectedDoc.extractedData?.diditDecision?.status === 'Approved'
                                ? 'bg-emerald-800/10 text-emerald-800 border-emerald-500/20'
                                : selectedDoc.extractedData?.diditDecision?.status === 'In Review'
                                ? 'bg-warning/10 text-warning border-warning/20'
                                : 'bg-red-800/10 text-red-800 border-red-500/20'
                            }`}
                          >
                            {selectedDoc.extractedData?.diditDecision?.status || 'Pendiente'}
                          </span>
                        </div>
                        {selectedDoc.extractedData?.expirationDate && (
                          <div className="flex items-center justify-between text-xs p-2.5 bg-base-200/30 rounded-lg border border-base-200">
                            <span>Fecha de Expiración:</span>
                            <span className="font-bold text-base-content text-[11px]">
                              {selectedDoc.extractedData.expirationDate}
                            </span>
                          </div>
                        )}
                        {selectedDoc.extractedData?.diditDecision?.id_verifications?.[0]?.document_type && (
                          <div className="flex items-center justify-between text-xs p-2.5 bg-base-200/30 rounded-lg border border-base-200">
                            <span>Tipo de Documento:</span>
                            <span className="font-bold text-base-content text-[11px]">
                              {selectedDoc.extractedData.diditDecision.id_verifications[0].document_type}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/40">Resultados Escaneo Automático</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs p-2.5 bg-base-200/30 rounded-lg border border-base-200">
                          <span>Coincidencia de Cédula:</span>
                          <span
                            className={`badge font-bold px-2 py-0.5 text-[10px] ${
                              selectedDoc.extractedData?.matchedNationalId
                                ? 'bg-emerald-800/10 text-emerald-800 border-emerald-500/20'
                                : 'bg-red-800/10 text-red-800 border-red-500/20'
                            }`}
                          >
                            {selectedDoc.extractedData?.matchedNationalId ? 'Coincide' : 'No Coincide'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs p-2.5 bg-base-200/30 rounded-lg border border-base-200">
                          <span>Coincidencia de Nombre:</span>
                          <span
                            className={`badge font-bold px-2 py-0.5 text-[10px] ${
                              selectedDoc.extractedData?.matchedName
                                ? 'bg-emerald-800/10 text-emerald-800 border-emerald-500/20'
                                : 'bg-red-800/10 text-red-800 border-red-500/20'
                            }`}
                          >
                            {selectedDoc.extractedData?.matchedName ? 'Coincide' : 'No Coincide'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OCR snippet extracted */}
                  {selectedDoc.extractedData?.extractedTextSnippet && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/40">Texto Extraído (OCR)</h4>
                      <div className="bg-base-200/40 p-2.5 rounded-xl border border-base-200 text-[10px] font-mono leading-normal max-h-[120px] overflow-y-auto text-base-content/75 text-left">
                        {selectedDoc.extractedData.extractedTextSnippet}
                      </div>
                    </div>
                  )}

                  {selectedDoc.extractedData?.workerError && (
                    <div className="alert alert-warning p-2.5 rounded-xl text-[10px] flex items-center gap-1.5 text-left">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>Fallo de procesamiento: {selectedDoc.extractedData.workerError}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 border-t border-base-200 mt-6">
                  <button
                    onClick={() => handleReview(selectedDoc.id, 'REJECTED')}
                    className="btn btn-error btn-outline flex-1 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all gap-1.5"
                    disabled={actionLoading}
                  >
                    <XCircle className="size-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleReview(selectedDoc.id, 'APPROVED')}
                    className="btn btn-success flex-1 rounded-xl text-white font-bold text-xs bg-emerald-600 border-none shadow-md hover:brightness-110 cursor-pointer active:scale-95 transition-all gap-1.5"
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
