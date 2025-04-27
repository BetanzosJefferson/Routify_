import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Trip } from "./use-driver-trips";

// Tipos de datos para pasajeros y reservaciones
export interface Passenger {
  id: number;
  firstName: string;
  lastName: string;
  reservationId: number;
}

export interface Reservation {
  id: number;
  tripId: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  email: string;
  phone: string;
  paymentMethod: string;
  paymentStatus: string;
  code?: string;
  notes?: string;
  totalAmount: number;
  passengers: Passenger[];
}

interface UseDriverReservationsOptions {
  tripId?: number;
  includeRelated?: boolean;
}

/**
 * Hook especializado para obtener reservaciones para conductores
 * 
 * Este hook permite a los conductores ver sus reservaciones de manera directa
 * sin depender de que primero se hayan cargado los viajes en otra sección.
 */
export function useDriverReservations(options: UseDriverReservationsOptions = {}) {
  const { user } = useAuth();
  const { tripId, includeRelated = false } = options;
  
  // Verificar si el usuario es un conductor
  const isDriver = user?.role === 'chofer' || user?.role === 'DRIVER';
  
  return useQuery<Reservation[]>({
    queryKey: [
      "/api/reservations", 
      { 
        driverId: isDriver ? user?.id : undefined,
        tripId,
        includeRelated
      }
    ],
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
      }
      
      // Si se solicita un viaje específico, siempre incluimos viajes relacionados
  // para asegurar que captamos todas las reservaciones relevantes
      if (tripId) {
        params.append("tripId", tripId.toString());
        // Forzar includeRelated a true cuando se especifica un tripId
        params.append("includeRelated", "true");
      }
      // Para otros casos, usar el valor de includeRelated proporcionado
      else if (includeRelated) {
        params.append("includeRelated", "true");
      }
      
      // Añadir parámetros a la URL si hay alguno
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`[useDriverReservations] Consultando reservaciones: ${url}`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        
        if (isDriver && user?.id) {
          console.log(`[useDriverReservations] Obtenidas ${reservations.length} reservaciones para conductor ${user.id}`);
        } else {
          console.log(`[useDriverReservations] Obtenidas ${reservations.length} reservaciones en total`);
        }
        
        // Si se solicitó un viaje específico, mostrar desglose
        if (tripId) {
          console.log(`[useDriverReservations] Reservaciones para viaje ${tripId}: ${reservations.length}`);
        }
        
        // Validar que todas las reservaciones tienen la estructura correcta de pasajeros
        return reservations.map((res: any) => {
          if (!res.passengers) {
            return { ...res, passengers: [] };
          } else if (!Array.isArray(res.passengers)) {
            return { ...res, passengers: [] };
          }
          return res;
        });
      } catch (error) {
        console.error("[useDriverReservations] Error al obtener reservaciones:", error);
        // Devolvemos un array vacío para evitar errores en cascada
        return [];
      }
    }
  });
}

/**
 * Hook para obtener todas las reservaciones para todos los viajes del conductor
 * 
 * Este hook proporciona todas las reservaciones de todos los viajes asignados
 * al conductor, centralizando la lógica en un solo lugar.
 */
export function useAllDriverReservations() {
  const { user } = useAuth();
  
  // Verificar si el usuario es un conductor
  const isDriver = user?.role === 'chofer' || user?.role === 'DRIVER';
  
  return useQuery<Reservation[]>({
    queryKey: ["/api/reservations", { driverId: isDriver ? user?.id : undefined }],
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!user, // Ejecutar para cualquier usuario autenticado
    queryFn: async () => {
      try {
        let url = "/api/reservations";
        
        // Para conductores, filtramos por su ID
        if (isDriver && user?.id) {
          url += `?driverId=${user.id}`;
          console.log(`[useAllDriverReservations] Obteniendo reservaciones para conductor ${user.id}`);
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        
        if (isDriver && user?.id) {
          console.log(`[useAllDriverReservations] Obtenidas ${reservations.length} reservaciones para conductor ${user.id}`);
        } else {
          console.log(`[useAllDriverReservations] Obtenidas ${reservations.length} reservaciones totales`);
        }
        
        // Validar estructura
        return reservations.map((res: any) => {
          if (!res.passengers) {
            return { ...res, passengers: [] };
          } else if (!Array.isArray(res.passengers)) {
            return { ...res, passengers: [] };
          }
          return res;
        });
      } catch (error) {
        console.error("[useAllDriverReservations] Error al obtener reservaciones:", error);
        // Devolvemos un array vacío para evitar errores en cascada
        return [];
      }
    }
  });
}