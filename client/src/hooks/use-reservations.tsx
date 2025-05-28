import { useQuery } from "@tanstack/react-query";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { useAuth } from "./use-auth";

type UseReservationsOptions = {
  enabled?: boolean;
  tripId?: number;
  includeRelated?: boolean;
  date?: string; // Formato YYYY-MM-DD
};

/**
 * Hook especializado para obtener reservaciones para cualquier rol de usuario
 */
export function useReservations(options: UseReservationsOptions = {}) {
  const { user } = useAuth();
  const { tripId, includeRelated = false, enabled = true, date } = options;
  
  // Si no se proporciona fecha, usar la fecha actual para optimizar la carga inicial
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dateFilter = date || currentDate;
  
  return useQuery<ReservationWithDetails[]>({
    queryKey: ["/api/reservations", { tripId, includeRelated, date: dateFilter }],
    enabled: !!user && enabled,
    staleTime: 5000,
    refetchInterval: 15000,
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
        
        // Agregar filtro de fecha (por defecto día actual)
        params.append("date", dateFilter);
        
        // Añadir los parámetros a la URL
        url += `?${params.toString()}`;
        
        console.log(`[useReservations] Obteniendo reservaciones para fecha ${dateFilter}: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        console.log(`[useReservations] Obtenidas ${reservations.length} reservaciones para ${dateFilter}`);
        
        return reservations;
      } catch (error) {
        console.error("[useReservations] Error al obtener reservaciones:", error);
        throw error;
      }
    }
  });
}