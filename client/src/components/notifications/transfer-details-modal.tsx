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
import { Notification } from '@/types';

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
  const { data: reservationsData, isLoading } = useQuery({
    queryKey: ['/api/reservations', transferData?.reservationIds],
    queryFn: async () => {
      if (!transferData?.reservationIds?.length) return [];
      
      // Obtener cada reservación individualmente
      const reservationPromises = transferData.reservationIds.map(id => 
        fetch(`/api/reservations/${id}`)
          .then(res => {
            if (!res.ok) throw new Error(`Error al obtener reservación ${id}`);
            return res.json();
          })
      );
      
      try {
        return await Promise.all(reservationPromises);
      } catch (error) {
        console.error('Error al obtener reservaciones:', error);
        return [];
      }
    },
    enabled: !!transferData?.reservationIds?.length
  });

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
                  className="border rounded-md p-3 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-sm">
                        Reservación #{reservation.id}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {reservation.trip?.route?.origin} → {reservation.trip?.route?.destination}
                      </p>
                    </div>
                    <Badge variant={
                      reservation.status === 'confirmado' ? 'default' :
                      reservation.status === 'pendiente' ? 'outline' :
                      reservation.status === 'cancelado' ? 'destructive' : 'secondary'
                    }>
                      {reservation.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Fecha:</span>{' '}
                      {reservation.trip?.departureDate && (
                        <span>
                          {format(new Date(reservation.trip.departureDate), "dd MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hora:</span>{' '}
                      <span>{reservation.trip?.departureTime}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-2" />
                  
                  <h5 className="text-xs font-medium mb-1">Pasajeros</h5>
                  <div className="space-y-1">
                    {reservation.passengers?.map((passenger: any) => (
                      <div key={passenger.id} className="text-xs flex items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mr-1.5"></span>
                        <span>{passenger.firstName} {passenger.lastName}</span>
                      </div>
                    ))}
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