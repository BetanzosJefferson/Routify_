import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Trip } from "./use-driver-trips";
import { Reservation } from "./use-driver-reservations";

/**
 * Hook especializado para obtener datos de resumen de viajes para conductores
 * 
 * Este hook permite cargar simultáneamente los viajes del conductor y sus reservaciones
 * para calcular métricas de resumen independientemente de otras secciones.
 */
export function useDriverTripSummary() {
  const { user } = useAuth();
  
  // Verificar si el usuario es un conductor
  const isDriver = user?.role === 'chofer' || user?.role === 'DRIVER';
  
  // Consulta para obtener viajes asignados al conductor
  const tripsQuery = useQuery<Trip[]>({
    queryKey: ["/api/trips", { driverId: isDriver ? user?.id : undefined }],
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!user, // Solo ejecutar la consulta cuando tengamos datos del usuario
    queryFn: async () => {
      // Construir la URL con los parámetros necesarios
      let url = "/api/trips";
      
      // Si el usuario es conductor, añadimos el parámetro driverId
      if (isDriver && user?.id) {
        url += `?driverId=${user.id}`;
        console.log(`[useDriverTripSummary] Solicitando viajes para conductor ID: ${user.id}`);
      }
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al cargar viajes: ${response.statusText}`);
        }
        
        const trips = await response.json();
        
        if (isDriver && user?.id) {
          console.log(`[useDriverTripSummary] Obtenidos ${trips.length} viajes para el conductor ${user.id}`);
        } else {
          console.log(`[useDriverTripSummary] Obtenidos ${trips.length} viajes totales`);
        }
        
        return trips;
      } catch (error) {
        console.error("[useDriverTripSummary] Error al cargar viajes:", error);
        return [];
      }
    }
  });
  
  // Consulta para obtener las reservaciones de los viajes del conductor
  const reservationsQuery = useQuery<Reservation[]>({
    queryKey: ["/api/reservations", { driverId: isDriver ? user?.id : undefined, includeRelated: true }],
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!user, // Ejecutar para cualquier usuario autenticado
    queryFn: async () => {
      // Construir la URL base
      let url = "/api/reservations";
      
      // Añadir parámetros según sea necesario
      const params = new URLSearchParams();
      
      // Para conductores, filtramos por su ID
      if (isDriver && user?.id) {
        params.append("driverId", user.id.toString());
        params.append("includeRelated", "true");
      }
      
      // Añadir parámetros a la URL si hay alguno
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`[useDriverTripSummary] Consultando reservaciones: ${url}`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        
        if (isDriver && user?.id) {
          console.log(`[useDriverTripSummary] Obtenidas ${reservations.length} reservaciones para conductor ${user.id}`);
        }
        
        // Validar que todas las reservaciones tienen la estructura correcta
        return reservations.map((res: any) => {
          if (!res.passengers) {
            return { ...res, passengers: [] };
          } else if (!Array.isArray(res.passengers)) {
            return { ...res, passengers: [] };
          }
          return res;
        });
      } catch (error) {
        console.error("[useDriverTripSummary] Error al obtener reservaciones:", error);
        return [];
      }
    }
  });
  
  return {
    trips: tripsQuery.data || [],
    reservations: reservationsQuery.data || [],
    isLoadingTrips: tripsQuery.isLoading,
    isLoadingReservations: reservationsQuery.isLoading,
    isRefetching: tripsQuery.isRefetching || reservationsQuery.isRefetching,
    refetch: () => {
      tripsQuery.refetch();
      reservationsQuery.refetch();
    }
  };
}