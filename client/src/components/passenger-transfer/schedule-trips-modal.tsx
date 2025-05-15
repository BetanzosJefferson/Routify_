import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Users, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ScheduleTripsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationIds: number[];
}

interface Trip {
  id: number;
  routeId: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  availableSeats: number;
  route: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    originState?: string;
    originCity?: string;
    destinationState?: string;
    destinationCity?: string;
  };
}

interface Reservation {
  id: number;
  status: string;
  trip: {
    id: number;
    departureDate: string;
    departureTime: string;
    route: {
      origin: string;
      destination: string;
      originState?: string;
      originCity?: string;
      destinationState?: string;
      destinationCity?: string;
    };
  };
}

export default function ScheduleTripsModal({ open, onOpenChange, reservationIds }: ScheduleTripsModalProps) {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [scheduledReservationIds, setScheduledReservationIds] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener reservaciones para identificar origen/destino
  const { data: reservations, isLoading: isLoadingReservations } = useQuery({
    queryKey: ['/api/reservations/details', reservationIds],
    queryFn: async () => {
      if (!reservationIds?.length) return [];
      
      // Obtener cada reservación individualmente
      const reservationPromises = reservationIds.map(id => 
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
        return results;
      } catch (error) {
        console.error('Error al obtener reservaciones:', error);
        return [];
      }
    },
    enabled: open && !!reservationIds?.length
  });

  // Actualizar estado local cuando cambian las reservaciones
  useEffect(() => {
    if (reservations) {
      setReservationsData(reservations);
    }
  }, [reservations]);

  // Extraer información de origen y destino para filtrar viajes disponibles
  const originInfo = reservationsData?.[0]?.trip?.route || null;
  
  // Función para extraer estado y ciudad de una ubicación completa
  const extractLocationInfo = (location: string | undefined) => {
    if (!location) return { state: null, city: null };
    
    // El formato típico es "Ciudad, Estado - Terminal"
    const parts = location.split(' - ');
    if (parts.length < 1) return { state: null, city: null };
    
    const cityState = parts[0].split(', ');
    if (cityState.length < 2) return { state: null, city: null };
    
    return {
      city: cityState[0].trim(),
      state: cityState[1].trim()
    };
  };
  
  // Extraer información de estado y ciudad cuando no estén disponibles como campos separados
  const originLocation = originInfo?.origin;
  const destinationLocation = originInfo?.destination;
  
  // Intentar obtener datos de estado y ciudad, primero de campos específicos, luego de la cadena completa
  const originState = originInfo?.originState || extractLocationInfo(originLocation).state;
  const originCity = originInfo?.originCity || extractLocationInfo(originLocation).city;
  const destinationState = originInfo?.destinationState || extractLocationInfo(destinationLocation).state;
  const destinationCity = originInfo?.destinationCity || extractLocationInfo(destinationLocation).city;
  
  // Verificar si tenemos toda la información necesaria
  const hasCompleteLocationInfo = !!originState && !!originCity && !!destinationState && !!destinationCity;
  
  // Consultar viajes disponibles con la misma ruta y con asientos disponibles
  const { data: availableTrips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ['/api/trips/available', originState, originCity, destinationState, destinationCity],
    queryFn: async () => {
      if (!hasCompleteLocationInfo) {
        console.log('Información geográfica incompleta:', {
          originState, originCity, destinationState, destinationCity
        });
        return [];
      }
      
      // Filtrar por información geográfica
      const params = new URLSearchParams({
        originState: originState!,
        originCity: originCity!,
        destinationState: destinationState!,
        destinationCity: destinationCity!,
        futureOnly: 'true',
        withAvailableSeats: 'true'
      });
      
      try {
        console.log('Buscando viajes con parámetros:', Object.fromEntries(params.entries()));
        const response = await fetch(`/api/trips/available?${params.toString()}`);
        if (!response.ok) throw new Error('Error al obtener viajes disponibles');
        
        const data = await response.json();
        console.log('Viajes encontrados (sin filtrar):', data.length);
        const filteredData = data.filter((trip: Trip) => trip.availableSeats >= reservationIds.length);
        console.log('Viajes filtrados por asientos disponibles:', filteredData.length);
        return filteredData;
      } catch (error) {
        console.error('Error al consultar viajes disponibles:', error);
        return [];
      }
    },
    enabled: open && hasCompleteLocationInfo
  });

  // Mutación para programar las reservaciones en un viaje seleccionado
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTripId || !reservationIds.length) {
        throw new Error('Falta información para programar las reservaciones');
      }
      
      const response = await fetch('/api/reservations/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reservationIds: reservationIds,
          tripId: selectedTripId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al programar reservaciones');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reservaciones programadas",
        description: `${data.count} reservaciones fueron programadas exitosamente en el viaje seleccionado.`,
      });
      
      // Actualizar estado local
      setScheduledReservationIds(reservationIds);
      
      // Invalidar consultas para actualizar datos
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al programar reservaciones",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Función para manejar el clic en el botón programar
  const handleSchedule = () => {
    if (!selectedTripId) {
      toast({
        title: "Selecciona un viaje",
        description: "Debes seleccionar un viaje para programar las reservaciones.",
        variant: "destructive"
      });
      return;
    }
    
    scheduleMutation.mutate();
  };

  // La variable hasCompleteLocationInfo ya verifica si se pueden mostrar viajes disponibles

  // Verificar si ya se programaron todas las reservaciones
  const allReservationsScheduled = scheduledReservationIds.length === reservationIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Agendar reservaciones transferidas</DialogTitle>
          <DialogDescription>
            Selecciona un viaje disponible para agendar las reservaciones transferidas
          </DialogDescription>
        </DialogHeader>

        {isLoadingReservations ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !hasCompleteLocationInfo ? (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded my-4">
            <p className="font-medium">No se puede mostrar viajes disponibles</p>
            <p className="text-sm">
              La información de origen (estado y ciudad) y destino (estado y ciudad) no está disponible 
              para estas reservaciones. Solo se pueden agendar reservaciones en viajes donde esta información está completa.
            </p>
          </div>
        ) : allReservationsScheduled ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded my-4 flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <p>Reservaciones agendadas exitosamente.</p>
          </div>
        ) : (
          <>
            <div className="bg-muted/30 p-4 rounded-md mb-4">
              <h3 className="text-sm font-semibold mb-2">Información de las reservaciones</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span className="text-muted-foreground">Origen:</span>{' '}
                  <span className="font-medium ml-1">
                    {originCity}, {originState}
                  </span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span className="text-muted-foreground">Destino:</span>{' '}
                  <span className="font-medium ml-1">
                    {destinationCity}, {destinationState}
                  </span>
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span className="text-muted-foreground">Pasajeros:</span>{' '}
                  <span className="font-medium ml-1">{reservationIds.length}</span>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold my-2">Viajes disponibles</h3>
            
            <ScrollArea className="flex-1 h-[400px] px-1">
              {isLoadingTrips ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : availableTrips?.length ? (
                <div className="space-y-4">
                  {availableTrips.map((trip: Trip) => (
                    <div 
                      key={trip.id} 
                      className={`border rounded-md p-3 hover:bg-accent/10 transition-colors cursor-pointer 
                      ${selectedTripId === trip.id ? 'border-primary bg-primary/5' : ''}`}
                      onClick={() => setSelectedTripId(trip.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-sm">
                            {trip.route.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {trip.route.origin} → {trip.route.destination}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {trip.availableSeats} asientos disponibles
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span>
                            {format(new Date(trip.departureDate), "dd MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span>Salida: {trip.departureTime}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span>Llegada: {trip.arrivalTime}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No se encontraron viajes disponibles con suficientes asientos para estas reservaciones.
                </div>
              )}
            </ScrollArea>
          </>
        )}
        
        <div className="flex justify-end mt-4 space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {!allReservationsScheduled && canShowTrips && (
            <Button 
              onClick={handleSchedule} 
              disabled={!selectedTripId || scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? 'Programando...' : 'Programar reservaciones'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}