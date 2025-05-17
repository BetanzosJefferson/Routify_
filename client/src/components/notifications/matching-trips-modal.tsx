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

  // Determinar el origen y destino según si es un sub-viaje o un viaje normal
  let originLocation = '';
  let destinationLocation = '';

  if (primaryReservation?.trip?.isSubTrip) {
    // Si es un sub-viaje, usamos segment_origin y segment_destination
    originLocation = primaryReservation?.trip?.segmentOrigin 
      ? getLocationInfo(primaryReservation.trip.segmentOrigin)
      : '';
    
    destinationLocation = primaryReservation?.trip?.segmentDestination 
      ? getLocationInfo(primaryReservation.trip.segmentDestination)
      : '';
    
    console.log('Usando datos de segmento para sub-viaje:', { 
      origin: originLocation, 
      destination: destinationLocation,
      reservationId: primaryReservation?.id
    });
  } else {
    // Si es un viaje normal, usamos origin y destination del route
    originLocation = primaryReservation?.trip?.route?.origin 
      ? getLocationInfo(primaryReservation.trip.route.origin)
      : '';
    
    destinationLocation = primaryReservation?.trip?.route?.destination 
      ? getLocationInfo(primaryReservation.trip.route.destination)
      : '';
    
    console.log('Usando datos de ruta para viaje normal:', { 
      origin: originLocation, 
      destination: destinationLocation,
      reservationId: primaryReservation?.id
    });
  }

  // Obtener todos los viajes disponibles
  const { data: matchingTrips, isLoading } = useQuery({
    queryKey: ['/api/trips/all'],
    queryFn: async () => {
      console.log('Buscando todos los viajes disponibles para transferencia...');
      
      try {
        // Obtener todos los viajes de la empresa logueada
        const response = await fetch('/api/trips');
        if (!response.ok) {
          throw new Error('Error al obtener viajes');
        }
        
        const trips = await response.json();
        console.log('Viajes obtenidos:', trips.length);
        
        // Preparar todos los viajes para mostrarlos en la interfaz
        const allTrips: any[] = [];
        
        // 1. Procesamos viajes padre
        const parentTrips = trips.filter((trip: any) => !trip.isSubTrip && !trip.parentTripId);
        parentTrips.forEach((parentTrip: any) => {
          // Marcamos viajes padre que coinciden con origen/destino de la reservación
          if (originLocation && destinationLocation) {
            const tripOrigin = parentTrip.route?.origin ? getLocationInfo(parentTrip.route.origin) : '';
            const tripDestination = parentTrip.route?.destination ? getLocationInfo(parentTrip.route.destination) : '';
            
            const originsMatch = tripOrigin.includes(originLocation) || originLocation.includes(tripOrigin);
            const destinationsMatch = tripDestination.includes(destinationLocation) || destinationLocation.includes(tripDestination);
            
            if (originsMatch && destinationsMatch) {
              parentTrip.isExactMatch = true;
            }
          }
          
          // Buscamos sus sub-viajes
          const subTrips = trips.filter((trip: any) => trip.isSubTrip && trip.parentTripId === parentTrip.id);
          
          // Verificamos si alguno de sus sub-viajes coincide con origen/destino
          if (originLocation && destinationLocation) {
            const hasMatchingSubTrips = subTrips.some((subTrip: any) => {
              if (!subTrip.segmentOrigin || !subTrip.segmentDestination) return false;
              
              const subTripOrigin = getLocationInfo(subTrip.segmentOrigin);
              const subTripDestination = getLocationInfo(subTrip.segmentDestination);
              
              const originsMatch = subTripOrigin.includes(originLocation) || originLocation.includes(subTripOrigin);
              const destinationsMatch = subTripDestination.includes(destinationLocation) || destinationLocation.includes(subTripDestination);
              
              return originsMatch && destinationsMatch;
            });
            
            if (hasMatchingSubTrips) {
              parentTrip.hasMatchingSubtrips = true;
            }
          }
          
          // Agregamos información sobre cuántos sub-viajes tiene
          if (subTrips.length > 0) {
            parentTrip.subTripCount = subTrips.length;
          }
          
          allTrips.push(parentTrip);
        });
        
        // 2. Procesamos sub-viajes
        const subTrips = trips.filter((trip: any) => trip.isSubTrip && trip.parentTripId);
        subTrips.forEach((subTrip: any) => {
          // Marcamos subviajes que coinciden con origen/destino
          if (originLocation && destinationLocation) {
            const subTripOrigin = subTrip.segmentOrigin ? getLocationInfo(subTrip.segmentOrigin) : '';
            const subTripDestination = subTrip.segmentDestination ? getLocationInfo(subTrip.segmentDestination) : '';
            
            const originsMatch = subTripOrigin.includes(originLocation) || originLocation.includes(subTripOrigin);
            const destinationsMatch = subTripDestination.includes(destinationLocation) || destinationLocation.includes(subTripDestination);
            
            if (originsMatch && destinationsMatch) {
              subTrip.isExactMatch = true;
            }
          }
          
          // Campos para mostrar en la interfaz
          subTrip.displayName = `Sub-viaje #${subTrip.id}`;
          subTrip.displayOrigin = subTrip.segmentOrigin;
          subTrip.displayDestination = subTrip.segmentDestination;
          
          // Enlace al viaje padre
          const parentTrip = trips.find((parent: any) => parent.id === subTrip.parentTripId);
          if (parentTrip) {
            subTrip.parentTripInfo = `(Parte de: Viaje #${parentTrip.id})`;
            
            // Agregar origen/destino completo del viaje padre para referencia
            subTrip.parentTripOrigin = parentTrip.route?.origin;
            subTrip.parentTripDestination = parentTrip.route?.destination;
          }
          
          allTrips.push(subTrip);
        });
        
        // Ordenar para mostrar primero las coincidencias exactas
        allTrips.sort((a, b) => {
          // 1. Coincidencias exactas primero
          if (a.isExactMatch && !b.isExactMatch) return -1;
          if (!a.isExactMatch && b.isExactMatch) return 1;
          
          // 2. Luego viajes padre con sub-viajes coincidentes
          if (a.hasMatchingSubtrips && !b.hasMatchingSubtrips) return -1;
          if (!a.hasMatchingSubtrips && b.hasMatchingSubtrips) return 1;
          
          // 3. Sub-viajes después de sus viajes padre
          if (!a.isSubTrip && b.isSubTrip) return -1;
          if (a.isSubTrip && !b.isSubTrip) return 1;
          
          // 4. Por fecha de salida (más reciente primero)
          return 0;
        });
        
        console.log('Total viajes procesados:', allTrips.length);
        return allTrips;
      } catch (error) {
        console.error('Error al buscar viajes:', error);
        return [];
      }
    },
    enabled: open
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
      
      // Primero, verificamos si la reservación original tenía un descuento aplicado
      let discountAmount = 0;
      let couponCode = '';
      let originalAmount = null;
      let finalTotal = newTotal;
      
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
      
      // Si no hay información de pago original, usamos valores predeterminados
      let advanceAmount = 0;
      let restAmount = 0;
      let advancePaymentMethod = currentReservation.advancePaymentMethod || 'efectivo';
      let restPaymentMethod = currentReservation.restPaymentMethod || 'transferencia';
      let paymentStatus = 'pendiente';
      
      // Si hay información de anticipo, la preservamos exactamente igual
      if (typeof currentReservation.advanceAmount === 'number') {
        // En lugar de calcular proporciones, mantenemos los valores exactos
        advanceAmount = currentReservation.advanceAmount;
        
        // El resto es la diferencia entre el total final y el anticipo
        restAmount = finalTotal - advanceAmount;
        
        // Determinamos el estado de pago
        if (advanceAmount >= finalTotal) {
          paymentStatus = 'pagado';
          advanceAmount = finalTotal; // Limitamos el anticipo al total
          restAmount = 0;
        } else {
          paymentStatus = 'pendiente';
        }
        
        // Preservamos los métodos de pago
        advancePaymentMethod = currentReservation.advancePaymentMethod || 'efectivo';
        restPaymentMethod = currentReservation.restPaymentMethod || 'transferencia';
        
        console.log('Información de pago transferida:', {
          originalAdvance: currentReservation.advanceAmount,
          originalTotal,
          newAdvance: advanceAmount,
          newTotal: finalTotal,
          restAmount,
          paymentStatus
        });
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
        // Estado de pago explícito según el anticipo
        paymentStatus: paymentStatus,
        
        // Campos opcionales
        notes: `Reservación transferida desde ID: ${currentReservation.id}`,
        advanceAmount: advanceAmount || 0,
        advancePaymentMethod: advancePaymentMethod || 'efectivo',
        
        // Solo agregamos discountAmount, originalAmount y couponCode si hay un descuento
        ...(discountAmount > 0 ? {
          discountAmount,
          originalAmount,
          couponCode
        } : {}),
        
        // Si el viaje es un sub-viaje, incluimos la información relacionada
        ...(tripData.isSubTrip ? {
          isSubtripReservation: true,
          parentTripId: tripData.parentTripId,
          segmentOrigin: tripData.segmentOrigin,
          segmentDestination: tripData.segmentDestination
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
        console.error('Detalles del error de creación:', errorData);
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
      
      // Información detallada para depuración
      console.log('Datos de reservación original:', {
        reservationId: primaryReservation?.id || 'Múltiple',
        tripId: primaryReservation?.tripId || 'Múltiple',
        isSubTrip: primaryReservation?.trip?.isSubTrip || 'Desconocido',
        segmentOrigin: primaryReservation?.trip?.segmentOrigin || 'No disponible',
        segmentDestination: primaryReservation?.trip?.segmentDestination || 'No disponible',
        routeOrigin: primaryReservation?.trip?.route?.origin || 'No disponible',
        routeDestination: primaryReservation?.trip?.route?.destination || 'No disponible'
      });
      
      console.log('Datos del viaje seleccionado:', {
        id: selectedTripData.id,
        isSubTrip: selectedTripData.isSubTrip || false,
        origin: selectedTripData.origin || selectedTripData.route?.origin || 'No disponible',
        destination: selectedTripData.destination || selectedTripData.route?.destination || 'No disponible',
        segmentOrigin: selectedTripData.segmentOrigin || 'No disponible',
        segmentDestination: selectedTripData.segmentDestination || 'No disponible',
        parentTripId: selectedTripData.parentTripId || 'No es sub-viaje'
      });
      
      // Verificar si el viaje seleccionado tiene sub-viajes que coincidan con el origen/destino
      // Si es así, intentaremos usar el sub-viaje coincidente en lugar del viaje padre
      let matchingSubTrip = null;
      
      // Obtener todos los subviajes del viaje seleccionado
      try {
        // Solo buscamos subviajes si tenemos origen y destino claros
        if (originLocation && destinationLocation) {
          console.log(`Buscando sub-viajes para el viaje padre ID ${selectedTrip} que coincidan con origen: ${originLocation}, destino: ${destinationLocation}`);
          
          // Obtener todos los viajes 
          const response = await fetch('/api/trips');
          const allTrips = await response.json();
          
          // Filtrar subviajes del viaje seleccionado
          const subTrips = allTrips.filter((trip: any) => 
            trip.isSubTrip === true && trip.parentTripId === selectedTrip
          );
          
          console.log(`Encontrados ${subTrips.length} sub-viajes para viaje padre ID ${selectedTrip}`);
          
          // Buscar un subviaje que coincida con el origen y destino
          matchingSubTrip = subTrips.find((subTrip: any) => {
            if (!subTrip.segmentOrigin || !subTrip.segmentDestination) return false;
            
            const subTripOrigin = getLocationInfo(subTrip.segmentOrigin);
            const subTripDestination = getLocationInfo(subTrip.segmentDestination);
            
            console.log(`  Sub-viaje ID ${subTrip.id}: ${subTripOrigin} → ${subTripDestination}`);
            
            const originsMatch = subTripOrigin.includes(originLocation) || originLocation.includes(subTripOrigin);
            const destinationsMatch = subTripDestination.includes(destinationLocation) || destinationLocation.includes(subTripDestination);
            
            const matches = originsMatch && destinationsMatch;
            if (matches) {
              console.log(`  ✓ Coincidencia encontrada en sub-viaje ${subTrip.id}!`);
            }
            
            return matches;
          });
          
          if (matchingSubTrip) {
            console.log('Se utilizará un sub-viaje específico para la transferencia:', matchingSubTrip);
            toast({
              title: "Sub-viaje encontrado",
              description: `Se asignará al segmento ${getLocationInfo(matchingSubTrip.segmentOrigin)} → ${getLocationInfo(matchingSubTrip.segmentDestination)}`,
            });
          }
        }
      } catch (error) {
        console.error('Error al buscar sub-viajes coincidentes:', error);
        // No interrumpimos el proceso si falla la búsqueda de sub-viajes
      }
      
          // Determinar qué viaje usar: si encontramos un sub-viaje coincidente, lo usamos
      // De lo contrario, usamos el viaje padre seleccionado
      const tripToUse = matchingSubTrip || selectedTripData;
      console.log('Viaje que se utilizará para la transferencia:', {
        id: tripToUse.id,
        isSubTrip: !!tripToUse.isSubTrip,
        origin: tripToUse.segmentOrigin || tripToUse.route?.origin,
        destination: tripToUse.segmentDestination || tripToUse.route?.destination
      });
      
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
            
            const result = await createSingleReservation(reservationsArray[i], tripToUse);
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
        
        const result = await createSingleReservation(reservation, tripToUse);
        
        // Mostrar mensaje de éxito
        toast({
          title: "¡Reservación creada!",
          description: `Reservación creada exitosamente con ID: ${result.id}`,
          variant: "default",
        });
      }
      
      // Cerrar el modal de selección de viajes
      onOpenChange(false);
      
      // Notificamos al componente padre que procesamos una reservación
      if (isMultipleReservations) {
        // Si hay múltiples reservaciones, se notifica que se completó todo el proceso
        window.dispatchEvent(new CustomEvent('transferComplete', {
          detail: { success: true, message: 'Todas las reservaciones transferidas' }
        }));
      } else {
        // Si es una sola reservación, notificamos que debemos continuar con las demás
        window.dispatchEvent(new CustomEvent('singleTransferComplete', {
          detail: { 
            success: true, 
            reservationId: reservation.id,
            message: `Reservación #${reservation.id} transferida exitosamente`
          }
        }));
      }
      
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
          
          <div className="mt-4 mb-2 bg-amber-50 border border-amber-200 rounded-md p-3 text-xs">
            <div className="font-medium mb-2">Guía de viajes:</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 rounded-full bg-green-100 border border-green-500"></span>
                <span><strong>Borde verde:</strong> Viajes que coinciden exactamente con el origen y destino de la reservación original.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 rounded-full bg-blue-50 border border-blue-400"></span>
                <span><strong>Borde azul:</strong> Viajes que tienen sub-segmentos que coinciden con el origen y destino.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 rounded-full bg-gray-50 border border-gray-300"></span>
                <span><strong>Sin destacar:</strong> Otros viajes disponibles que no coinciden con el origen/destino original.</span>
              </div>
            </div>
            {originLocation && destinationLocation && (
              <div className="mt-2 font-medium">
                Buscando coincidencias para: {originLocation} → {destinationLocation}
              </div>
            )}
          </div>
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
                  className={`border rounded-md p-4 hover:bg-accent/10 transition-colors cursor-pointer 
                    ${selectedTrip === trip.id ? 'border-primary bg-primary/5' : ''}
                    ${trip.isExactMatch ? 'border-green-500 bg-green-50/10' : ''}
                    ${trip.hasMatchingSubtrips && !trip.isExactMatch ? 'border-blue-400 bg-blue-50/10' : ''}
                  `}
                  onClick={() => setSelectedTrip(trip.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">
                        {trip.isSubTrip ? `Sub-viaje #${trip.id}` : `Viaje #${trip.id}`}
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        {trip.route?.name || 
                         (trip.isSubTrip && trip.segmentOrigin && trip.segmentDestination) 
                         ? `${trip.segmentOrigin} → ${trip.segmentDestination}` 
                         : trip.route ? `${trip.route.origin} → ${trip.route.destination}` : 'Sin ruta'
                        }
                      </div>
                      {trip.isSubTrip && trip.parentTripId && (
                        <div className="text-xs text-blue-600 mt-1">
                          (Parte de: Viaje #{trip.parentTripId})
                        </div>
                      )}
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
                    <div className="text-muted-foreground mb-1">
                      {trip.isSubTrip && trip.segmentOrigin 
                        ? trip.segmentOrigin 
                        : trip.route?.origin}
                    </div>
                    <div className="font-medium mb-1">Destino:</div>
                    <div className="text-muted-foreground">
                      {trip.isSubTrip && trip.segmentDestination 
                        ? trip.segmentDestination 
                        : trip.route?.destination}
                    </div>
                    
                    {/* Información adicional sobre viajes y coincidencias */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trip.isExactMatch && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Coincidencia exacta
                        </span>
                      )}
                      {trip.hasMatchingSubtrips && !trip.isExactMatch && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          ℹ️ Tiene sub-viajes coincidentes
                        </span>
                      )}
                      {trip.isSubTrip && trip.isExactMatch && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Sub-viaje con coincidencia
                        </span>
                      )}
                      {trip.isSubTrip && !trip.isExactMatch && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Sub-viaje
                        </span>
                      )}
                      {trip.subTripCount > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {trip.subTripCount} sub-viajes
                        </span>
                      )}
                    </div>
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