'use client';

import { ShareLocationModalProps, TrackingLink } from '@/types';
import { useState, useEffect } from 'react';
import { X, Copy, Share2, Check, Loader2, MapPin, Clock, ExternalLink } from 'lucide-react';
import api from '@/utils/client/api-client';
import { MobileDrawer } from './MobileDrawer';

export default function ShareLocationModal({
  isOpen,
  onClose,
  vehicleId,
  vehicleName,
  onLinkGenerated,
  showToast,
}: ShareLocationModalProps) {
  // Prevenir errores de hidratación entre servidor y cliente (hydration mismatch)
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('24h');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detectar pantalla móvil
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Limpiar el estado al abrir o cerrar el modal
  useEffect(() => {
    if (isOpen) {
      setClientName('');
      setSelectedDuration('24h');
      setGeneratedLink(null);
      setIsCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (!mounted) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await api.post(`/vehicles/${vehicleId}/tracking-links`, {
        clientName: clientName.trim() || undefined,
      });
      const data = res.data;
      setGeneratedLink(data.trackingUrl);
      onLinkGenerated(data);
    } catch (err) {
      // Registrar error en consola (en español)
      console.error('Error al generar enlace de rastreo:', err);
      showToast('Error al generar enlace de rastreo', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setIsCopied(true);
    showToast('Enlace copiado al portapapeles');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!generatedLink) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Rastreo de ${vehicleName}`,
          text: `Sigue la ubicación en vivo del vehículo ${vehicleName}:`,
          url: generatedLink,
        });
      } catch (err) {
        // Omitir error de cancelación por parte del usuario
        console.error('Error al compartir enlace:', err);
      }
    } else {
      handleCopy();
    }
  };

  const renderForm = () => {
    return (
      <form onSubmit={handleGenerate} className="space-y-4">
        {/* Nombre del Cliente */}
        <div className="form-control w-full">
          <label className="label py-1">
            <span className="label-text font-semibold text-xs text-base-content/70">
              Nombre del Cliente (Opcional)
            </span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Ej. Cliente ABC"
            className="input input-bordered w-full text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Dirección de Destino - Próximamente */}
        <div className="form-control w-full">
          <label className="label py-1 flex justify-between items-center">
            <span className="label-text font-semibold text-xs text-base-content/70">
              Dirección de Destino
            </span>
            <span className="badge badge-sm badge-outline text-[9px] uppercase font-bold text-base-content/50 border-base-300 tracking-wider">
              Próximamente
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              disabled
              placeholder="Ej. Puerto de Balboa, Panamá..."
              className="input input-bordered w-full text-sm bg-base-200/50 cursor-not-allowed opacity-60 pl-9"
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
          </div>
        </div>

        {/* Duración del Enlace */}
        <div className="form-control w-full">
          <label className="label py-1">
            <span className="label-text font-semibold text-xs text-base-content/70">
              Duración del Enlace
            </span>
          </label>
          <div className="flex gap-2">
            {[
              { id: '2h', label: '2 Horas' },
              { id: '12h', label: '12 Horas' },
              { id: '24h', label: '24 Horas' },
            ].map((dur) => {
              const isSelected = selectedDuration === dur.id;
              return (
                <button
                  key={dur.id}
                  type="button"
                  onClick={() => setSelectedDuration(dur.id)}
                  className={`btn btn-sm flex-1 font-bold ${
                    isSelected
                      ? 'btn-primary text-white border-primary'
                      : 'btn-outline border-base-300 text-base-content/70 hover:bg-base-200'
                  }`}
                >
                  {dur.label}
                </button>
              );
            })}
          </div>
          {selectedDuration !== '24h' && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium flex items-center gap-1 animate-in fade-in duration-200">
              <Clock className="size-3 shrink-0" />
              La duración personalizada estará disponible pronto. Por ahora expira en 24h.
            </p>
          )}
        </div>

        {/* Botón de Generar */}
        <button
          type="submit"
          disabled={isGenerating}
          className="btn btn-primary w-full text-white font-bold gap-2 mt-4"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generando enlace...
            </>
          ) : (
            <>
              <Share2 className="size-4" />
              Generar Enlace
            </>
          )}
        </button>
      </form>
    );
  };

  const renderSuccess = () => {
    const isShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-500" />
          ¡Enlace generado! Expira en 24 horas.
        </div>

        <div className="form-control w-full">
          <label className="label py-1">
            <span className="label-text font-semibold text-xs text-base-content/70">
              Enlace de Rastreo
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={generatedLink || ''}
              className="input input-bordered flex-1 text-xs font-mono bg-base-200 text-base-content/80 select-all"
            />
            <button
              onClick={handleCopy}
              className={`btn btn-square ${isCopied ? 'btn-success text-white border-success' : 'btn-primary text-white border-primary'}`}
              title="Copiar"
            >
              {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleShare}
            className="btn btn-primary flex-1 text-white font-bold gap-2"
          >
            <Share2 className="size-4" />
            {isShareSupported ? 'Compartir' : 'Copiar Enlace'}
          </button>
          {generatedLink && (
            <a
              href={generatedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline border-base-300 hover:bg-base-200 text-base-content gap-2"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        <button
          onClick={onClose}
          className="btn btn-outline border-base-300 hover:bg-base-200 w-full font-bold mt-2"
        >
          Cerrar
        </button>
      </div>
    );
  };

  if (isMobile) {
    return (
      <MobileDrawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Compartir Ubicación"
        subtitle={`Enlace público para ${vehicleName}`}
        onClose={onClose}
        height="auto"
        paddingBottom="calc(1.5rem + env(safe-area-inset-bottom))"
      >
        <div className="px-5 pb-5 text-base-content">
          {generatedLink ? renderSuccess() : renderForm()}
        </div>
      </MobileDrawer>
    );
  }

  // Vista de escritorio - Renderizado inline en lugar de portal para evitar problemas de focos de Radix
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Fondo oscuro traslúcido */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in duration-200 z-0"
        onClick={onClose}
      />

      {/* Tarjeta Modal */}
      <div className="relative w-full max-w-md bg-base-100 border border-base-300 shadow-2xl rounded-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 text-base-content z-10">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-lg tracking-tight text-base-content">Compartir Ubicación</h3>
            <p className="text-xs text-base-content/60 font-medium mt-0.5">
              Generar un enlace público para {vehicleName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content hover:bg-base-200"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulario o Estado de éxito */}
        {generatedLink ? renderSuccess() : renderForm()}
      </div>
    </div>
  );
}
