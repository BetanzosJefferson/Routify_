import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import MatchingTripsModal from './matching-trips-modal';
import TransferredReservationCard from './transferred-reservation-card';

// Definir la interfaz de Notification localmente para evitar dependencias circulares
interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  userId: number;
  relatedId: number | null;
  metaData?: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TransferDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
}

interface TransferData {
  reservationIds: number[];
  transferDate: string;
  sourceCompany: string;
  sourceUser: {
    id: number;
    name: string;
  };
  count: number;
}

const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({ 
  open, 
  onOpenChange,
  notification 
}) => {
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [showMatchingTripsModal, setShowMatchingTripsModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);

  // Extraer los datos de la transferencia desde metaData
  useEffect(() => {
    if (notification?.metaData) {
      try {
        const parsedData = JSON.parse(notification.metaData);
        setTransferData(parsedData);
      } catch (error) {
        console.error('Error al parsear metaData:', error);
        setTransferData(null);
      }
    } else {
      setTransferData(null);
    }
  }, [notification]);

  // Consultar los detalles de las reservaciones transferidas
  const { data: reservationsData, isLoading, error } = useQuery({
    queryKey: ['/api/reservations', transferData?.reservationIds],
    queryFn: async () => {
      if (!transferData?.reservationIds?.length) return [];
      
      console.log('Consultando reservaciones con IDs:', transferData.reservationIds);
      
      // Obtener cada reservación individualmente
      const reservationPromises = transferData.reservationIds.map(id => 
        fetch(`/api/reservations/${id}`)
          .then(res => {
            if (!res.ok) {
              console.error(`Error al obtener reservación ${id}: ${res.status} ${res.statusText}`);
              throw new Error(`Error al obtener reservación ${id}`);
            }
            return res.json();
          })
      );
      
      try {
        const results = await Promise.all(reservationPromises);
        console.log('Reservaciones obtenidas:', results);
        return results;
      } catch (error) {
        console.error('Error al obtener reservaciones:', error);
        return [];
      }
    },
    enabled: !!transferData?.reservationIds?.length,
    retry: 1 // Solo intentar una vez más en caso de error
  });
  
  // Si hay error, mostrar en consola
  useEffect(() => {
    if (error) {
      console.error('Error en la consulta de reservaciones:', error);
    }
  }, [error]);

  if (!notification) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalles de Transferencia</DialogTitle>
            <DialogDescription>
              Información de las reservaciones transferidas
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col space-y-3 mb-3">
            <div className="bg-muted/30 p-4 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold">Información de transferencia</h3>
                {transferData && (
                  <Badge variant="outline">
                    {format(new Date(transferData.transferDate), "dd MMM yyyy • HH:mm", { locale: es })}
                  </Badge>
                )}
              </div>
              
              {transferData ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Empresa origen:</span>{' '}
                    <span className="font-medium">{transferData.sourceCompany}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transferido por:</span>{' '}
                    <span className="font-medium">{transferData.sourceUser.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cantidad:</span>{' '}
                    <span className="font-medium">{transferData.count} reservación(es)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              )}
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-sm font-semibold my-2">Detalles de pasajeros</h3>
          
          <ScrollArea className="flex-1 h-[500px] px-1">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : reservationsData?.length ? (
              <div>
                {reservationsData.map((reservation: any) => (
                  <TransferredReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onContinue={(reservation) => {
                      setSelectedReservation(reservation);
                      setShowMatchingTripsModal(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No se encontraron detalles de las reservaciones transferidas.
              </div>
            )}
          </ScrollArea>
          
          <div className="flex justify-between mt-4">
            <div className="flex flex-col space-y-2 w-full">
              <p className="text-sm text-muted-foreground mb-2">
                Para transferir múltiples reservaciones con diferentes rutas, selecciona cada una individualmente:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {reservationsData?.map((res: any) => {
                  // Determinamos origen y destino según si es un sub-viaje o viaje normal
                  let originText = 'Origen no disponible';
                  let destText = 'Destino no disponible';
                  
                  if (res?.trip?.isSubTrip) {
                    // Para sub-viajes usamos segment_origin y segment_destination
                    originText = res.trip.segmentOrigin?.split(' - ')[0] || 'Origen no disponible';
                    destText = res.trip.segmentDestination?.split(' - ')[0] || 'Destino no disponible';
                  } else if (res?.trip?.route) {
                    // Para viajes normales usamos origin y destination del route
                    originText = res.trip.route.origin?.split(' - ')[0] || 'Origen no disponible';
                    destText = res.trip.route.destination?.split(' - ')[0] || 'Destino no disponible';
                  }
                  
                  return (
                    <Button 
                      key={res.id}
                      variant="outline"
                      className="justify-start flex-col items-start p-4 h-auto text-left" 
                      onClick={() => {
                        // Seleccionamos una sola reservación
                        setSelectedReservation(res);
                        setShowMatchingTripsModal(true);
                      }}
                    >
                      <span className="font-bold">Transferir #{res.id}</span>
                      <span className="text-sm text-muted-foreground mt-1">{originText} → {destText}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal para seleccionar viajes coincidentes */}
      {selectedReservation && (
        <MatchingTripsModal
          open={showMatchingTripsModal}
          onOpenChange={setShowMatchingTripsModal}
          reservation={selectedReservation}
        />
      )}
    </>
  );
};

export default TransferDetailsModal;