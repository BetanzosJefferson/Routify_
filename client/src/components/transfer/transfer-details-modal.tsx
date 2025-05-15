import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserIcon, Users, CalendarIcon, TruckIcon, BuildingIcon } from 'lucide-react';

interface TransferDetailsModalProps {
  open: boolean;
  onClose: () => void;
  notificationId: number;
  transferData?: {
    transferId?: number;
    reservationIds?: number[];
    sourceCompanyId?: string;
    targetCompanyId?: string;
    timestamp?: string;
  };
}

interface Passenger {
  id: number;
  firstName: string;
  lastName: string;
  reservationId: number;
}

interface Reservation {
  id: number;
  tripId: number;
  passengers: Passenger[];
  totalAmount: number;
  paymentStatus: string;
  departureDate: string;
  origin: string;
  destination: string;
  companyId: string;
}

export function TransferDetailsModal({ 
  open, 
  onClose, 
  notificationId,
  transferData 
}: TransferDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'passengers'>('passengers');

  // Consultar detalles de transferencia si no se proporcionaron
  const { data: transferDetails, isLoading } = useQuery({
    queryKey: ['/api/transfers/details', notificationId],
    enabled: open && notificationId > 0 && !transferData,
  });

  // Combinar datos de transferencia proporcionados o recuperados de la API
  const details = transferData || transferDetails;

  // Consultar detalles de las reservaciones transferidas
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations/by-ids', details?.reservationIds],
    enabled: open && details?.reservationIds && details.reservationIds.length > 0,
  });

  // Contar el número total de pasajeros
  const totalPassengers = reservations?.reduce((total, res) => total + (res.passengers?.length || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalles de Transferencia de Pasajeros</DialogTitle>
          <DialogDescription>
            Información sobre los pasajeros transferidos a tu empresa
          </DialogDescription>
        </DialogHeader>

        <div className="flex space-x-2 mb-4">
          <Button 
            variant={activeTab === 'info' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setActiveTab('info')}
          >
            Información General
          </Button>
          <Button 
            variant={activeTab === 'passengers' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setActiveTab('passengers')}
          >
            Pasajeros {totalPassengers > 0 && <Badge className="ml-1">{totalPassengers}</Badge>}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activeTab === 'info' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1 opacity-70" />
                Fecha de transferencia
              </p>
              <p className="font-medium">
                {details?.timestamp 
                  ? format(new Date(details.timestamp), 'PPp', { locale: es })
                  : 'Fecha no disponible'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center">
                <BuildingIcon className="h-4 w-4 mr-1 opacity-70" />
                Empresa origen
              </p>
              <p className="font-medium">
                {details?.sourceCompanyId || 'No disponible'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center">
                <Users className="h-4 w-4 mr-1 opacity-70" />
                Total de pasajeros
              </p>
              <p className="font-medium">
                {totalPassengers} pasajero{totalPassengers !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center">
                <TruckIcon className="h-4 w-4 mr-1 opacity-70" />
                Reservaciones transferidas
              </p>
              <p className="font-medium">
                {details?.reservationIds?.length || 0} reservación(es)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoadingReservations ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !reservations || reservations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No hay información disponible sobre las reservaciones transferidas</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pasajero</TableHead>
                      <TableHead>Reservación</TableHead>
                      <TableHead>Origen - Destino</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.flatMap(reservation => 
                      (reservation.passengers || []).map(passenger => (
                        <TableRow key={`${reservation.id}-${passenger.id}`}>
                          <TableCell className="font-medium flex items-center">
                            <UserIcon className="h-4 w-4 mr-2 opacity-70" />
                            {passenger.firstName} {passenger.lastName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              #{reservation.id}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">
                            {reservation.origin} - {reservation.destination}
                          </TableCell>
                          <TableCell className="text-sm">
                            {reservation.departureDate 
                              ? format(new Date(reservation.departureDate), 'P', { locale: es })
                              : 'No disponible'
                            }
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}