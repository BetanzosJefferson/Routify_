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
        
        <ScrollArea className="flex-1 h-[400px] px-1">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : reservationsData?.length ? (
            <div className="space-y-4">
              {reservationsData.map((reservation: any) => (
                <div 
                  key={reservation.id} 
                  className="border rounded-md p-4 hover:bg-accent/10 transition-colors"
                >
                  {/* Encabezado */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-base">
                        Reservación #{reservation.id}
                      </h4>
                      <div className="text-sm text-muted-foreground mt-1">
                        {reservation.trip?.route?.origin} → {reservation.trip?.route?.destination}
                      </div>
                    </div>
                    <Badge variant={
                      reservation.status === 'confirmado' || reservation.status === 'confirmed' ? 'default' :
                      reservation.status === 'pendiente' ? 'outline' :
                      reservation.status === 'cancelado' ? 'destructive' : 'secondary'
                    } className="ml-2">
                      {reservation.status}
                    </Badge>
                  </div>
                  
                  {/* Información de la reservación */}
                  <div className="bg-muted/30 rounded-md p-3 mb-3">
                    <h5 className="text-sm font-medium mb-2">Información de la reservación</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">ID:</span>{' '}
                        <span className="font-medium">{reservation.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Precio:</span>{' '}
                        <span className="font-medium">${reservation.totalAmount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Estado de pago:</span>{' '}
                        <span className="font-medium">{reservation.paymentStatus || 'No definido'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Método de pago:</span>{' '}
                        <span className="font-medium">{reservation.paymentMethod || 'No definido'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{' '}
                        <span className="font-medium">{reservation.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Teléfono:</span>{' '}
                        <span className="font-medium">{reservation.phone}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Creada:</span>{' '}
                        <span>
                          {reservation.createdAt && 
                            format(new Date(reservation.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actualizada:</span>{' '}
                        <span>
                          {reservation.updatedAt && 
                            format(new Date(reservation.updatedAt), "dd MMM yyyy HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Información del viaje */}
                  <div className="bg-muted/30 rounded-md p-3 mb-3">
                    <h5 className="text-sm font-medium mb-2">Información del viaje (ID: {reservation.trip?.id})</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Fecha:</span>{' '}
                        {reservation.trip?.departureDate && (
                          <span className="font-medium">
                            {format(new Date(reservation.trip.departureDate), "dd MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hora salida:</span>{' '}
                        <span className="font-medium">{reservation.trip?.departureTime}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hora llegada:</span>{' '}
                        <span className="font-medium">{reservation.trip?.arrivalTime}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Precio:</span>{' '}
                        <span className="font-medium">${reservation.trip?.price}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Asientos disponibles:</span>{' '}
                        <span className="font-medium">{reservation.trip?.availableSeats}/{reservation.trip?.capacity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ruta ID:</span>{' '}
                        <span className="font-medium">{reservation.trip?.routeId}</span>
                      </div>
                    </div>
                    
                    {/* Paradas */}
                    {reservation.trip?.segmentPrices && reservation.trip.segmentPrices.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-medium mb-1">Segmentos del viaje:</div>
                        <div className="space-y-1 text-xs">
                          {reservation.trip.segmentPrices.map((segment: any, index: number) => (
                            <div key={index} className="border-l-2 border-primary/50 pl-2 py-1">
                              <div className="flex justify-between">
                                <div className="font-medium">{segment.origin} → {segment.destination}</div>
                                <div>${segment.price}</div>
                              </div>
                              <div className="text-muted-foreground mt-0.5">
                                {segment.departureTime} - {segment.arrivalTime}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Pasajeros */}
                  <div className="bg-muted/30 rounded-md p-3">
                    <h5 className="text-sm font-medium mb-2">Pasajeros</h5>
                    <div className="space-y-2">
                      {reservation.passengers?.map((passenger: any) => (
                        <div key={passenger.id} className="text-xs border-l-2 border-primary pl-2 py-1">
                          <div className="flex justify-between">
                            <span className="font-medium">{passenger.firstName} {passenger.lastName}</span>
                            <span className="text-muted-foreground">ID: {passenger.id}</span>
                          </div>
                          {passenger.seatNumber && (
                            <div className="text-muted-foreground mt-0.5">
                              Asiento: {passenger.seatNumber}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No se encontraron detalles de las reservaciones transferidas.
            </div>
          )}
        </ScrollArea>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferDetailsModal;