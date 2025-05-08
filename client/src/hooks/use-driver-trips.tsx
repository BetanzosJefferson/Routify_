import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

// Definición del tipo de vehículo asignado
export interface AssignedVehicle {
  id: number;
  brand: string;
  model: string;
  plates: string;
  economicNumber: string;
}

// Tipo de vehículo antiguo (para compatibilidad)
export interface VehicleOld {
  id: number;
  name: string;
  licensePlate?: string;
}

// Tipos de datos básicos para viajes
export interface Trip {
  id: number;
  routeId: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  status?: "scheduled" | "in-progress" | "completed" | "cancelled";
  capacity: number;
  availableSeats: number;
  vehicleType?: string;
  vehicleId?: number;
  driverId?: number;
  isSubTrip: boolean;
  parentTripId?: number;
  segmentOrigin?: string;
  segmentDestination?: string;
  companyId?: string;
  assignedVehicle?: AssignedVehicle;
  
  // Backward compatibility with existing code
  vehicle?: VehicleOld;
  route?: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    stops: string[];
  };
}

/**
 * Hook personalizado para obtener viajes del conductor actual
 * 
 * Este hook simplifica la carga de datos para conductores, asegurando
 * que se carguen sus viajes asignados directamente sin depender de 
 * otras secciones de la aplicación
 */
export function useDriverTrips() {
  const { user } = useAuth();
  
  // Verificar si el usuario es un conductor
  const isDriver = user?.role === 'chofer' || user?.role === 'DRIVER';
  
  // Obtener viajes asignados al conductor
  return useQuery<Trip[]>({
    queryKey: ["/api/trips"], 
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!user, // Solo ejecutar la consulta cuando tengamos datos del usuario
    queryFn: async () => {
      // Construir la URL con los parámetros necesarios
      let url = "/api/trips";
      
      // Si el usuario es conductor, añadimos el parámetro driverId
      if (isDriver && user?.id) {
        url += `?driverId=${user.id}`;
        console.log(`[useDriverTrips] Solicitando viajes para conductor ID: ${user.id}`);
      }
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al cargar viajes: ${response.statusText}`);
        }
        
        const trips = await response.json();
        
        if (isDriver && user?.id) {
          console.log(`[useDriverTrips] Obtenidos ${trips.length} viajes para el conductor ${user.id}`);
        } else {
          console.log(`[useDriverTrips] Obtenidos ${trips.length} viajes totales`);
        }
        
        return trips;
      } catch (error) {
        console.error("[useDriverTrips] Error al cargar viajes:", error);
        // Devolver array vacío en lugar de lanzar error para evitar fallos en cascada
        return [];
      }
    }
  });
}

/**
 * Hook para obtener detalles de un viaje específico
 * 
 * Este hook permite cargar los detalles de un viaje sin depender de
 * que se hayan cargado todos los viajes previamente
 */
export function useTripDetails(tripId: number | null) {
  return useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!tripId, // Solo ejecutar si tenemos un ID de viaje válido
    queryFn: async () => {
      if (!tripId) throw new Error("ID de viaje no proporcionado");
      
      try {
        console.log(`[useTripDetails] Cargando detalles de viaje: ${tripId}`);
        const response = await fetch(`/api/trips/${tripId}`);
        
        if (!response.ok) {
          throw new Error(`Error al cargar detalles del viaje: ${response.statusText}`);
        }
        
        const trip = await response.json();
        console.log(`[useTripDetails] Viaje cargado correctamente: ID ${trip.id}`);
        return trip;
      } catch (error) {
        console.error(`[useTripDetails] Error al cargar detalles del viaje ${tripId}:`, error);
        // Devolver un objeto con datos mínimos en lugar de lanzar error
        return {
          id: tripId,
          routeId: 0,
          departureDate: new Date().toISOString(),
          departureTime: "00:00 AM",
          arrivalTime: "00:00 AM",
          price: 0,
          capacity: 0,
          availableSeats: 0,
          isSubTrip: false
        };
      }
    }
  });
}