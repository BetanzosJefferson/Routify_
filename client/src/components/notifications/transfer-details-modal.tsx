import React, { useState, useEffect, useCallback } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MatchingTripsModal from './matching-trips-modal';
import TransferredReservationCard from './transferred-reservation-card';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [showMatchingTripsModal, setShowMatchingTripsModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [processedReservationIds, setProcessedReservationIds] = useState<number[]>([]);

  // Extraer los datos de la transferencia desde metaData
  useEffect(() => {
    if (notification?.metaData) {
      try {
        const parsedData = JSON.parse(notification.metaData);
        setTransferData(parsedData);
        // Al abrir un nuevo modal, reiniciamos los IDs procesados
        setProcessedReservationIds([]);
      } catch (error) {
        console.error('Error al parsear metaData:', error);
        setTransferData(null);
      }
    } else {
      setTransferData(null);
    }
  }, [notification]);
  
  // Manejar el evento de transferencia completa de una reservación individual
  const handleSingleTransferComplete = useCallback((event: CustomEvent) => {
    const { success, reservationId, message } = event.detail;
    
    if (success) {
      // Mostrar mensaje de éxito
      toast({
        title: "Transferencia exitosa",
        description: message,
        variant: "default",
      });
      
      // Agregar el ID de la reservación a la lista de procesados
      setProcessedReservationIds(prev => [...prev, reservationId]);
      
      // Actualizar la lista de reservaciones
      if (transferData?.reservationIds) {
        queryClient.invalidateQueries({ queryKey: ['/api/reservations', transferData.reservationIds] });
      }
    }
  }, [toast, queryClient, transferData]);
  
  // Manejar el evento de transferencia completa para todas las reservaciones
  const handleTransferComplete = useCallback((event: CustomEvent) => {
    const { success, message } = event.detail;
    
    if (success) {
      // Mostrar mensaje de éxito
      toast({
        title: "Todas las transferencias completadas",
        description: message,
        variant: "default",
      });
      
      // Actualizar la lista de reservaciones
      if (transferData?.reservationIds) {
        queryClient.invalidateQueries({ queryKey: ['/api/reservations', transferData.reservationIds] });
      }
    }
  }, [toast, queryClient, transferData]);
  
  // Agregar/remover event listeners
  useEffect(() => {
    window.addEventListener('singleTransferComplete', handleSingleTransferComplete as EventListener);
    window.addEventListener('transferComplete', handleTransferComplete as EventListener);
    
    return () => {
      window.removeEventListener('singleTransferComplete', handleSingleTransferComplete as EventListener);
      window.removeEventListener('transferComplete', handleTransferComplete as EventListener);
    };
  }, [handleSingleTransferComplete, handleTransferComplete]);

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
                {reservationsData.map((reservation: any) => {
                  const isProcessed = processedReservationIds.includes(reservation.id);
                  
                  return (
                    <TransferredReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      processed={isProcessed}
                      onContinue={isProcessed ? undefined : (reservation) => {
                        setSelectedReservation(reservation);
                        setShowMatchingTripsModal(true);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No se encontraron detalles de las reservaciones transferidas.
              </div>
            )}
          </ScrollArea>
          
          <div className="flex justify-between mt-4">
            <Button 
              onClick={async () => {
                try {
                  // Solo permitir aceptar si hay reservaciones sin procesar
                  const pendingReservations = reservationsData?.filter((res: any) => 
                    !processedReservationIds.includes(res.id)
                  );
                  
                  if (!pendingReservations?.length) {
                    toast({
                      title: "Sin reservaciones pendientes",
                      description: "Todas las reservaciones ya han sido procesadas.",
                      variant: "default",
                    });
                    return;
                  }
                  
                  // Realizar solicitud para aceptar todas las transferencias
                  const reservationIds = pendingReservations.map((res: any) => res.id);
                  
                  toast({
                    title: "Procesando transferencias",
                    description: `Aceptando ${reservationIds.length} reservación(es)...`,
                    variant: "default",
                  });
                  
                  const response = await fetch('/api/reservations/accept-transfer', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ reservationIds }),
                  });
                  
                  if (!response.ok) {
                    throw new Error('Error al aceptar transferencias');
                  }
                  
                  const result = await response.json();
                  
                  // Actualizar la lista de reservaciones
                  queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
                  
                  // Marcar todas las reservaciones como procesadas
                  setProcessedReservationIds(prev => [...prev, ...reservationIds]);
                  
                  toast({
                    title: "Transferencias aceptadas",
                    description: result.message || "Las reservaciones han sido aceptadas exitosamente.",
                    variant: "default",
                  });
                } catch (error) {
                  console.error('Error al aceptar transferencias:', error);
                  toast({
                    title: "Error",
                    description: "No se pudieron aceptar las transferencias. Intente nuevamente.",
                    variant: "destructive",
                  });
                }
              }}
              variant="default"
              disabled={isLoading || !reservationsData?.length || reservationsData?.every((res: any) => processedReservationIds.includes(res.id))}
            >
              Aceptar todas las transferencias
            </Button>
            
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