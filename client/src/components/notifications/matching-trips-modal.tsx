import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface MatchingTripsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: any;
}

const MatchingTripsModal: React.FC<MatchingTripsModalProps> = ({
  open,
  onOpenChange,
  reservation
}) => {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);

  // Extraer origen y destino de la reservación
  const getLocationInfo = (location: string) => {
    // Extraer solo la parte de ciudad y estado (hasta el primer guión)
    if (!location) return '';
    const parts = location.split(' - ');
    return parts[0].trim();
  };

  const originLocation = reservation?.trip?.route?.origin 
    ? getLocationInfo(reservation.trip.route.origin)
    : '';
  
  const destinationLocation = reservation?.trip?.route?.destination 
    ? getLocationInfo(reservation.trip.route.destination)
    : '';

  // Obtener viajes que coincidan con origen y destino
  const { data: matchingTrips, isLoading } = useQuery({
    queryKey: ['/api/trips/matching', originLocation, destinationLocation],
    queryFn: async () => {
      if (!originLocation || !destinationLocation) return [];

      console.log('Buscando viajes con origen:', originLocation, 'y destino:', destinationLocation);
      
      try {
        // Obtener todos los viajes de la empresa logueada
        const response = await fetch('/api/trips');
        if (!response.ok) {
          throw new Error('Error al obtener viajes');
        }
        
        const trips = await response.json();
        console.log('Viajes obtenidos:', trips.length);
        
        // Filtrar viajes que sean "padre" y tengan origen/destino coincidente
        const filtered = trips.filter((trip: any) => {
          // Verificar que sea un viaje padre
          const isParentTrip = !trip.isSubTrip && !trip.parentTripId;
          
          if (!isParentTrip) return false;
          
          // Obtener origen y destino del viaje (hasta el guión)
          const tripOrigin = trip.route?.origin ? getLocationInfo(trip.route.origin) : '';
          const tripDestination = trip.route?.destination ? getLocationInfo(trip.route.destination) : '';
          
          // Comparar orígenes y destinos
          const originsMatch = tripOrigin.includes(originLocation) || originLocation.includes(tripOrigin);
          const destinationsMatch = tripDestination.includes(destinationLocation) || destinationLocation.includes(tripDestination);
          
          return originsMatch && destinationsMatch;
        });
        
        console.log('Viajes filtrados coincidentes:', filtered.length);
        return filtered;
      } catch (error) {
        console.error('Error al buscar viajes coincidentes:', error);
        return [];
      }
    },
    enabled: open && !!originLocation && !!destinationLocation
  });

  const handleNextAction = async () => {
    if (!selectedTrip) {
      toast({
        title: "Selección requerida",
        description: "Por favor, selecciona un viaje para continuar",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreatingReservation(true);
    console.log('Viaje seleccionado para asignar reservación:', selectedTrip);
    
    try {
      // Obtener el viaje seleccionado de nuestra lista de viajes
      const selectedTripData = matchingTrips?.find((trip: any) => trip.id === selectedTrip);
      
      if (!selectedTripData) {
        throw new Error('No se encontró el viaje seleccionado');
      }
      
      // Preparar los datos de la nueva reservación a partir de la reservación transferida
      const newReservationData = {
        tripId: selectedTrip,
        totalAmount: selectedTripData.price,
        email: reservation.email,
        phone: reservation.phone,
        notes: `Reservación transferida desde ID: ${reservation.id}`,
        paymentMethod: reservation.paymentMethod || 'efectivo',
        paymentStatus: reservation.paymentStatus || 'pagado',
        status: 'confirmed',
        advanceAmount: reservation.advanceAmount || reservation.totalAmount,
        advancePaymentMethod: reservation.advancePaymentMethod || reservation.paymentMethod || 'efectivo',
        passengers: reservation.passengers.map((passenger: any) => ({
          firstName: passenger.firstName,
          lastName: passenger.lastName
        }))
      };
      
      console.log('Creando nueva reservación con datos:', newReservationData);
      
      // Mostrar notificación de proceso
      toast({
        title: "Creando reservación...",
        description: "Espera mientras procesamos la información",
      });
      
      // Enviar la solicitud para crear la nueva reservación
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newReservationData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear la reservación');
      }
      
      const result = await response.json();
      
      // Mostrar mensaje de éxito
      toast({
        title: "¡Reservación creada!",
        description: `Reservación creada exitosamente con ID: ${result.id}`,
        variant: "default",
      });
      
      // Cerrar el modal
      onOpenChange(false);
      
      // Esperar un momento antes de redirigir para que el usuario vea la notificación
      setTimeout(() => {
        window.location.href = '/reservations';
      }, 1500);
      
    } catch (error) {
      console.error('Error al crear la reservación:', error);
      toast({
        title: "Error al crear la reservación",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive",
      });
    } finally {
      setIsCreatingReservation(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Viajes Disponibles</DialogTitle>
          <DialogDescription>
            Selecciona un viaje disponible para asignar la reservación transferida
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted/30 rounded-md p-3 mb-4">
          <h3 className="text-sm font-medium mb-2">Buscando viajes que coincidan con:</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Origen:</span>{' '}
              <span className="font-medium">{originLocation}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destino:</span>{' '}
              <span className="font-medium">{destinationLocation}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Reservación ID:</span>{' '}
              <span className="font-medium">#{reservation?.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pasajeros:</span>{' '}
              <span className="font-medium">{reservation?.passengers?.length || 0}</span>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Buscando viajes coincidentes...</p>
            </div>
          ) : matchingTrips?.length ? (
            <div className="space-y-4">
              {matchingTrips.map((trip: any) => (
                <div 
                  key={trip.id} 
                  className={`border rounded-md p-4 hover:bg-accent/10 transition-colors cursor-pointer ${
                    selectedTrip === trip.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedTrip(trip.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">
                        Viaje #{trip.id}
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        {trip.route?.name || `${trip.route?.origin} → ${trip.route?.destination}`}
                      </div>
                    </div>
                    <Badge>
                      {trip.availableSeats} asientos disponibles
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Fecha:</span>{' '}
                      {trip.departureDate && (
                        <span className="font-medium">
                          {format(new Date(trip.departureDate), "dd MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Precio:</span>{' '}
                      <span className="font-medium">${trip.price}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Salida:</span>{' '}
                      <span className="font-medium">{trip.departureTime}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Llegada:</span>{' '}
                      <span className="font-medium">{trip.arrivalTime}</span>
                    </div>
                  </div>

                  {/* Detalles de la ruta */}
                  <Separator className="my-2" />
                  <div className="text-xs">
                    <div className="font-medium mb-1">Origen:</div>
                    <div className="text-muted-foreground mb-1">{trip.route?.origin}</div>
                    <div className="font-medium mb-1">Destino:</div>
                    <div className="text-muted-foreground">{trip.route?.destination}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No se encontraron viajes que coincidan con el origen y destino de la reservación.
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="flex justify-between gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreatingReservation}>
            Cancelar
          </Button>
          <Button 
            disabled={!selectedTrip || isLoading || isCreatingReservation} 
            onClick={handleNextAction}
          >
            {isCreatingReservation ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando reservación...
              </>
            ) : (
              'Asignar a este viaje'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MatchingTripsModal;