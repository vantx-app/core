import { MobileFleetDrawerProps } from '@/types';
import React from 'react';
import { MobileDrawer } from './MobileDrawer';
import { Locate, X } from 'lucide-react';

export const MobileFleetDrawer = ({
  isMobile,
  vehicleId,
  connectionStatus,
  snapPoint,
  setSnapPoint,
  handleVehicleSelection,
  renderVehicleList,
  renderVehicleDetail,
  closedHeight,
  followedVehicleId,
  onExitFollow,
}: MobileFleetDrawerProps) => {

  const snapPoints = React.useMemo(() => [closedHeight, 1], [closedHeight]);

  if (!isMobile) return null;

  // Indicador derecho del header: muestra estado de seguimiento o conexión
  const renderHeaderRight = () => {
    if (followedVehicleId && vehicleId === followedVehicleId) {
      // Modo seguimiento activo — mostrar pill con opción de salir
      return (
        <button
          onClick={onExitFollow}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-success/15 border border-success/30 rounded-full text-success"
        >
          <Locate className="size-3 animate-pulse" />
          <span className="text-[10px] font-mono font-bold uppercase">Siguiendo</span>
          <X className="size-3 ml-0.5" />
        </button>
      );
    }
    if (!vehicleId) {
      return (
        <div className="flex items-center gap-2 px-2 py-1 bg-base-200 rounded-full">
          <div className={`size-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-success' : 'bg-error'} ${connectionStatus === 'Connected' && 'animate-pulse'}`} />
          <span className="text-[10px] font-mono font-bold uppercase">{connectionStatus === 'Connected' ? 'Live' : 'Off'}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <MobileDrawer
      open={true}
      onOpenChange={() => { }}
      title={vehicleId ? 'Detalles del Vehículo' : 'Mi Flota'}
      onBack={vehicleId ? () => handleVehicleSelection() : undefined}
      snapPoints={snapPoints}
      activeSnapPoint={snapPoint}
      setActiveSnapPoint={setSnapPoint}
      dismissible={false}
      modal={false}
      height="100dvh"
      paddingBottom="calc(100px + env(safe-area-inset-bottom))"
      headerRight={renderHeaderRight()}
    >
      {vehicleId ? renderVehicleDetail() : renderVehicleList()}
    </MobileDrawer>
  );
};