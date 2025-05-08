import { useQuery } from "@tanstack/react-query";
import { TripMaster, TripSegment } from "@shared/schema";
import { useAuth } from "./use-auth";
import { formatDateForApiQuery } from "@/lib/utils";

type UseOptimizedTripsOptions = {
  enabled?: boolean;
  routeId?: number;
  departureDate?: string;
  searchTerm?: string;
  archived?: boolean;
};

// Tipo para la respuesta de viaje optimizado con datos enriquecidos
export type EnrichedOptimizedTrip = TripMaster & {
  route?: any;
  vehicle?: any;
  driver?: any;
  segments?: TripSegment[];
};

/**
 * Hook especializado para obtener viajes optimizados
 */
export function useOptimizedTrips(options: UseOptimizedTripsOptions = {}) {
  const { user } = useAuth();
  const { routeId, departureDate, searchTerm, archived = false, enabled = true } = options;
  
  return useQuery<EnrichedOptimizedTrip[]>({
    queryKey: ["/api/optimized/trips", { routeId, departureDate, searchTerm, archived }],
    enabled: !!user && enabled,
    staleTime: 5000, // Datos considerados frescos por 5 segundos
    refetchInterval: 15000, // Actualizar cada 15 segundos
    queryFn: async () => {
      try {
        // Construir la URL base
        let url = "/api/optimized/trips";
        
        // Añadir parámetros según sea necesario
        const params = new URLSearchParams();
        
        // Siempre pasar el estado de archivado
        params.append("archived", archived.toString());
        
        if (routeId) {
          params.append("routeId", routeId.toString());
        }
        
        if (departureDate) {
          // Normalizar la fecha para la API
          try {
            // Si la fecha ya está en formato YYYY-MM-DD, usarla directamente
            const normalizedDate = departureDate.includes('-') && departureDate.split('-').length === 3
              ? departureDate
              : formatDateForApiQuery(new Date(departureDate));
              
            console.log(`[useOptimizedTrips] Fecha normalizada para API: ${normalizedDate} (original: ${departureDate})`);
            params.append("startDate", normalizedDate);
          } catch (e) {
            console.warn(`[useOptimizedTrips] Error al formatear fecha: ${e}. Usando fecha original.`);
            params.append("startDate", departureDate);
          }
        }
        
        // Añadir los parámetros a la URL si hay alguno
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log(`[useOptimizedTrips] Obteniendo viajes: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener viajes optimizados: ${response.statusText}`);
        }
        
        const trips = await response.json();
        console.log(`[useOptimizedTrips] Obtenidos ${trips.length} viajes optimizados`);
        
        return trips;
      } catch (error) {
        console.error("[useOptimizedTrips] Error al obtener viajes optimizados:", error);
        throw error;
      }
    }
  });
}

/**
 * Hook para obtener un viaje optimizado específico con todos sus segmentos
 */
export function useOptimizedTripDetails(tripId?: number) {
  const { user } = useAuth();
  
  return useQuery<EnrichedOptimizedTrip>({
    queryKey: ["/api/optimized/trips", tripId],
    enabled: !!user && !!tripId,
    staleTime: 5000,
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        if (!tripId) {
          throw new Error("ID de viaje no proporcionado");
        }
        
        const url = `/api/optimized/trips/${tripId}`;
        console.log(`[useOptimizedTripDetails] Obteniendo detalles del viaje: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener detalles del viaje optimizado: ${response.statusText}`);
        }
        
        const trip = await response.json();
        console.log(`[useOptimizedTripDetails] Obtenidos detalles del viaje optimizado ${tripId}`);
        
        return trip;
      } catch (error) {
        console.error(`[useOptimizedTripDetails] Error al obtener detalles del viaje optimizado ${tripId}:`, error);
        throw error;
      }
    }
  });
}