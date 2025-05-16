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
  reservation: any; // Puede ser un objeto de reservación o un array de reservaciones
}

const MatchingTripsModal: React.FC<MatchingTripsModalProps> = ({
  open,
  onOpenChange,
  reservation
}) => {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  
  // Determinar si estamos procesando múltiples reservaciones
  const isMultipleReservations = Array.isArray(reservation);
  
  // Si es un array de reservaciones, usamos la primera para la búsqueda de viajes coincidentes
  const primaryReservation = isMultipleReservations ? reservation[0] : reservation;

  // Extraer origen y destino de la reservación
  const getLocationInfo = (location: string) => {
    // Extraer solo la parte de ciudad y estado (hasta el primer guión)
    if (!location) return '';
    const parts = location.split(' - ');
    return parts[0].trim();
  };

  const originLocation = primaryReservation?.trip?.route?.origin 
    ? getLocationInfo(primaryReservation.trip.route.origin)
    : '';
  
  const destinationLocation = primaryReservation?.trip?.route?.destination 
    ? getLocationInfo(primaryReservation.trip.route.destination)
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

  // Función para crear una reservación
  const createSingleReservation = async (currentReservation: any, tripData: any) => {
    try {
      // Preparar los datos de la nueva reservación a partir de la reservación transferida
      const passengers = currentReservation.passengers?.map((passenger: any) => ({
        firstName: passenger.firstName || 'Pasajero',
        lastName: passenger.lastName || 'Transferido'
      })) || [{firstName: 'Pasajero', lastName: 'Transferido'}];
      
      // Preservar la estructura exacta de los pagos originales
      // Adaptamos el precio total al nuevo viaje pero mantenemos proporciones
      const originalTotal = currentReservation.totalAmount || 0;
      const newTotal = tripData.price || 0;
      
      // Si no hay información de pago original, usamos valores predeterminados
      let advanceAmount = 0;
      let restAmount = 0;
      let advancePaymentMethod = currentReservation.advancePaymentMethod || 'efectivo';
      let restPaymentMethod = currentReservation.restPaymentMethod || 'transferencia';
      let paymentStatus = 'pendiente';
      
      // Si hay información de anticipo, la preservamos proporcionalmente
      if (typeof currentReservation.advanceAmount === 'number') {
        // Calculamos la proporción del anticipo respecto al total original
        const proportion = originalTotal > 0 ? currentReservation.advanceAmount / originalTotal : 0;
        // Aplicamos esa misma proporción al nuevo total
        advanceAmount = Math.round(newTotal * proportion);
        restAmount = newTotal - advanceAmount;
        
        // Determinamos el estado de pago
        if (advanceAmount >= newTotal) {
          // Si es pago completo, usamos "pagado" que es el valor correcto en el backend
          paymentStatus = 'pagado';
          advanceAmount = newTotal;
          restAmount = 0;
        } else if (advanceAmount > 0) {
          // Para pagos parciales usamos "pendiente" por ahora
          paymentStatus = 'pendiente';
        } else {
          paymentStatus = 'pendiente';
        }
        
        // Preservamos los métodos de pago
        advancePaymentMethod = currentReservation.advancePaymentMethod || 'efectivo';
        restPaymentMethod = currentReservation.restPaymentMethod || 'transferencia';
      }
      
      // Creamos la estructura básica de la reservación con solo los campos requeridos
      // Verificar si la reservación original tenía un descuento aplicado
      let discountAmount = 0;
      let couponCode = '';
      let finalTotal = newTotal;
      let originalAmount = null;
      
      // Si hay un cupón o descuento en la reservación original, lo preservamos
      if (currentReservation.discountAmount > 0 || currentReservation.couponCode) {
        // Calculamos el porcentaje de descuento respecto al total original
        const discountPercentage = currentReservation.discountAmount && originalTotal > 0 
          ? (currentReservation.discountAmount / originalTotal) * 100 
          : 0;
        
        // Aplicamos ese mismo porcentaje al nuevo total
        if (discountPercentage > 0) {
          discountAmount = Math.round((discountPercentage / 100) * newTotal);
          finalTotal = newTotal - discountAmount;
          originalAmount = newTotal; // Guardamos el precio original antes del descuento
          couponCode = currentReservation.couponCode || 'TRANSFERIDO';
          
          console.log('Aplicando descuento transferido:', {
            originalDiscount: currentReservation.discountAmount,
            discountPercentage,
            newDiscount: discountAmount,
            couponCode,
            originalTotal,
            newTotal,
            finalTotal,
            originalAmount
          });
        }
      }
      
      // Construir el objeto de reservación con los campos obligatorios
      const newReservationData = {
        // Campos requeridos por la validación en el backend
        tripId: tripData.id,
        totalAmount: finalTotal,
        email: currentReservation.email || 'transferencia@ejemplo.com',
        phone: currentReservation.phone || '0000000000',
        paymentMethod: 'efectivo', // Siempre usamos efectivo como valor predeterminado
        numPassengers: passengers.length,
        passengers: passengers,
        
        // Campos opcionales
        notes: `Reservación transferida desde ID: ${currentReservation.id}`,
        advanceAmount: advanceAmount || 0,
        advancePaymentMethod: advancePaymentMethod || 'efectivo',
        
        // Solo agregamos discountAmount, originalAmount y couponCode si hay un descuento
        ...(discountAmount > 0 ? {
          discountAmount,
          originalAmount,
          couponCode
        } : {})
      };
      
      console.log('Creando nueva reservación con datos:', newReservationData);
      
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
      return result;
    } catch (error) {
      console.error('Error al crear la reservación individual:', error);
      throw error;
    }
  };

  // Función principal para manejar la acción de asignar reservaciones
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
    console.log('Viaje seleccionado para asignar reservación(es):', selectedTrip);
    
    try {
      // Obtener el viaje seleccionado de nuestra lista de viajes
      const selectedTripData = matchingTrips?.find((trip: any) => trip.id === selectedTrip);
      
      if (!selectedTripData) {
        throw new Error('No se encontró el viaje seleccionado');
      }
      
      // Determinar si estamos procesando varias reservaciones o solo una
      if (isMultipleReservations) {
        // Estamos procesando múltiples reservaciones
        const reservationsArray = reservation as any[];
        setTotalToProcess(reservationsArray.length);
        
        toast({
          title: "Procesando múltiples reservaciones",
          description: `Creando ${reservationsArray.length} reservaciones...`,
        });
        
        const createdReservations = [];
        let errors = 0;
        
        // Procesar cada reservación secuencialmente
        for (let i = 0; i < reservationsArray.length; i++) {
          setProcessingIndex(i + 1);
          
          try {
            // Notificar al usuario del progreso
            toast({
              title: `Procesando ${i + 1} de ${reservationsArray.length}`,
              description: `Reservación #${reservationsArray[i].id}`,
            });
            
            const result = await createSingleReservation(reservationsArray[i], selectedTripData);
            createdReservations.push(result);
            
            // Pequeña pausa para evitar sobrecargar el servidor
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            errors++;
            console.error(`Error en reservación #${reservationsArray[i].id}:`, error);
          }
        }
        
        // Mostrar resumen final
        if (errors === 0) {
          toast({
            title: "¡Todas las reservaciones creadas!",
            description: `Se crearon ${createdReservations.length} reservaciones exitosamente`,
            variant: "default",
          });
        } else {
          toast({
            title: "Proceso completado con errores",
            description: `Se crearon ${createdReservations.length} de ${reservationsArray.length} reservaciones`,
            variant: errors > createdReservations.length ? "destructive" : "default",
          });
        }
        
      } else {
        // Estamos procesando una sola reservación
        toast({
          title: "Creando reservación...",
          description: "Espera mientras procesamos la información",
        });
        
        const result = await createSingleReservation(reservation, selectedTripData);
        
        // Mostrar mensaje de éxito
        toast({
          title: "¡Reservación creada!",
          description: `Reservación creada exitosamente con ID: ${result.id}`,
          variant: "default",
        });
      }
      
      // Cerrar el modal
      onOpenChange(false);
      
      // Esperar un momento antes de redirigir para que el usuario vea la notificación
      setTimeout(() => {
        window.location.href = '/reservations';
      }, 1500);
      
    } catch (error) {
      console.error('Error en el proceso de creación de reservaciones:', error);
      toast({
        title: "Error en el proceso",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive",
      });
    } finally {
      setIsCreatingReservation(false);
      setProcessingIndex(0);
      setTotalToProcess(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Viajes Disponibles</DialogTitle>
          <DialogDescription>
            {isMultipleReservations 
              ? `Selecciona un viaje para asignar las ${Array.isArray(reservation) ? reservation.length : 0} reservaciones transferidas`
              : "Selecciona un viaje disponible para asignar la reservación transferida"
            }
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
            {isMultipleReservations ? (
              <>
                <div>
                  <span className="text-muted-foreground">Cantidad de reservaciones:</span>{' '}
                  <span className="font-medium">{Array.isArray(reservation) ? reservation.length : 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">IDs:</span>{' '}
                  <span className="font-medium">
                    {Array.isArray(reservation) 
                      ? reservation.slice(0, 3).map((r: any) => `#${r.id}`).join(', ') + 
                        (reservation.length > 3 ? ` y ${reservation.length - 3} más...` : '')
                      : ''}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-muted-foreground">Reservación ID:</span>{' '}
                  <span className="font-medium">#{primaryReservation?.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pasajeros:</span>{' '}
                  <span className="font-medium">{primaryReservation?.passengers?.length || 0}</span>
                </div>
              </>
            )}
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
                {isMultipleReservations ? (
                  totalToProcess > 0 ? (
                    `Procesando ${processingIndex}/${totalToProcess}...`
                  ) : (
                    'Procesando reservaciones...'
                  )
                ) : (
                  'Creando reservación...'
                )}
              </>
            ) : (
              isMultipleReservations ? (
                `Asignar ${Array.isArray(reservation) ? reservation.length : 0} reservaciones`
              ) : (
                'Asignar a este viaje'
              )
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MatchingTripsModal;