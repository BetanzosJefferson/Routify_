import { Trip, Route, TripWithTimes } from "@shared/schema";

// Definimos el tipo de parada en la ruta
interface StopOnRoute {
  stopId: number;
  stopIndex: number;
  stopName?: string;
  location?: string;
  stopType?: string;
}

// Tipo personalizado para el formulario
interface FormTrip {
  routeId: number;
  departureDate: string | Date;
  capacity: number;
  availableSeats?: number;
  price: number;
  departureTime?: string;
  arrivalTime?: string;
  segmentPrices?: any;
  vehicleId?: number | null;
  driverId?: number | null;
  companyId?: string | null;
  archived?: boolean;
}

/**
 * Función para convertir un viaje desde el modelo antiguo al modelo optimizado
 * @param trip Viaje en formato antiguo
 * @param route Información de la ruta (con paradas)
 * @returns Datos estructurados para crear un viaje optimizado
 */
export function convertTripToOptimized(
  trip: Trip | TripWithTimes | FormTrip,
  route: Route & { stops?: string[] | StopOnRoute[] }
) {
  // Si no hay ruta o paradas, no podemos optimizar
  if (!route || !route.stops || route.stops.length < 1) {
    throw new Error("La ruta debe tener al menos una parada para optimizar el viaje");
  }
  
  // Convertir las paradas a objetos StopOnRoute si son strings
  let stopsObjects: StopOnRoute[] = [];
  
  // Verificar si las paradas son strings (desde la API) o ya son objetos
  if (typeof route.stops[0] === 'string') {
    console.log("[TripOptimizer] Convirtiendo paradas de strings a objetos");
    
    // Crear array con el origen como primera parada
    const allStops = [
      { 
        stopId: 0, 
        stopIndex: 0, 
        location: route.origin,
        stopName: route.origin,
        stopType: "origin"
      },
      // Convertir las paradas intermedias
      ...((route.stops as string[]).map((stop, index) => ({
        stopId: index + 1,
        stopIndex: index + 1,
        location: stop,
        stopName: stop,
        stopType: "stop"
      }))),
      // Añadir el destino como última parada
      { 
        stopId: route.stops.length + 1, 
        stopIndex: route.stops.length + 1, 
        location: route.destination,
        stopName: route.destination,
        stopType: "destination"
      }
    ];
    
    stopsObjects = allStops;
  } else {
    // Las paradas ya son objetos
    stopsObjects = [...(route.stops as StopOnRoute[])];
  }
  
  // Ordenar las paradas por su índice
  const orderedStops = [...stopsObjects].sort((a, b) => a.stopIndex - b.stopIndex);
  
  // Crear datos del viaje maestro
  // Convertir departureDate si viene como string
  let departureDate = trip.departureDate;
  console.log("[TripOptimizer] Tipo de departureDate:", typeof departureDate, departureDate);
  
  if (typeof departureDate === 'string') {
    try {
      departureDate = new Date(departureDate);
      console.log("[TripOptimizer] departureDate convertido a Date:", departureDate);
    } catch (error) {
      console.error("[TripOptimizer] Error al convertir departureDate a Date:", error);
      // Usar la fecha actual como fallback
      departureDate = new Date();
    }
  }

  const tripMaster = {
    routeId: trip.routeId,
    departureDate: departureDate,
    capacity: trip.capacity || 18,
    availableSeats: trip.availableSeats || trip.capacity || 18,
    price: typeof trip.price === 'number' ? trip.price : 0,
    departureTime: trip.departureTime || null,
    arrivalTime: trip.arrivalTime || null,
    vehicleId: trip.vehicleId || null,
    driverId: trip.driverId || null,
    companyId: trip.companyId || null,
    archived: false // Los viajes nuevos no están archivados por defecto
  };
  
  // Crear segmentos para cada par de paradas consecutivas
  const segments = [];
  
  for (let i = 0; i < orderedStops.length - 1; i++) {
    const originStop = orderedStops[i];
    const destinationStop = orderedStops[i + 1];
    
    // Calcular hora de salida y llegada para este segmento específico
    // Esto es una simplificación; podríamos mejorar estos cálculos en el futuro
    
    // Asegurar que tenemos ubicaciones para los segmentos
    const originLocation = originStop.location || `Parada-${originStop.stopIndex}`;
    const destinationLocation = destinationStop.location || `Parada-${destinationStop.stopIndex}`;
    
    segments.push({
      originStopId: originStop.stopId,
      destinationStopId: destinationStop.stopId,
      originStopIndex: originStop.stopIndex,
      destinationStopIndex: destinationStop.stopIndex,
      origin: originLocation,
      destination: destinationLocation, 
      availableSeats: trip.capacity || 18, // Inicialmente todos los asientos están disponibles, default 18
      price: calculateSegmentPrice(typeof trip.price === 'number' ? trip.price : 450, originStop.stopIndex, destinationStop.stopIndex, orderedStops.length - 1)
    });
  }
  
  return {
    tripMaster,
    segments,
    routeId: trip.routeId
  };
}

/**
 * Calcula el precio para un segmento específico basado en la distancia proporcional
 * @param totalPrice Precio total del viaje
 * @param originIndex Índice de la parada de origen
 * @param destinationIndex Índice de la parada de destino
 * @param totalStops Total de paradas en la ruta
 * @returns Precio calculado para el segmento
 */
function calculateSegmentPrice(
  totalPrice: number,
  originIndex: number,
  destinationIndex: number,
  totalStops: number
): number {
  // Distancia de este segmento como proporción del viaje total
  const segmentDistance = destinationIndex - originIndex;
  const totalDistance = totalStops;
  
  // El precio del segmento es proporcional a su distancia relativa
  const segmentPrice = Math.round((segmentDistance / totalDistance) * totalPrice);
  
  // Asegurar un precio mínimo
  return Math.max(segmentPrice, 20);
}