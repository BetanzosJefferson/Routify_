import { useQuery } from "@tanstack/react-query";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { useAuth } from "./use-auth";

type UseReservationsOptions = {
  enabled?: boolean;
  tripId?: number;
  includeRelated?: boolean;
};

/**
 * Hook especializado para obtener reservaciones para cualquier rol de usuario
 */
export function useReservations(options: UseReservationsOptions = {}) {
  const { user } = useAuth();
  const { tripId, includeRelated = false, enabled = true } = options;
  
  return useQuery<ReservationWithDetails[]>({
    queryKey: ["/api/reservations", { tripId, includeRelated }],
    enabled: !!user && enabled,
    staleTime: 30000, // Mantener datos por 30 segundos sin refrescar
    refetchInterval: 60000, // Refrescar cada 60 segundos en lugar de 15
    queryFn: async () => {
      try {
        // Construir la URL base
        let url = "/api/reservations";
        
        // Añadir parámetros según sea necesario
        const params = new URLSearchParams();
        
        if (tripId) {
          params.append("tripId", tripId.toString());
        }
        
        if (includeRelated) {
          params.append("includeRelated", "true");
        }
        
        // Añadir los parámetros a la URL si hay alguno
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log(`[useReservations] Obteniendo reservaciones: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        console.log(`[useReservations] Obtenidas ${reservations.length} reservaciones`);
        
        return reservations;
      } catch (error) {
        console.error("[useReservations] Error al obtener reservaciones:", error);
        throw error;
      }
    }
  });
}