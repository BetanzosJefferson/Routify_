import { Trip, Route, StopsOnRoutes } from "@shared/schema";

/**
 * Función para convertir un viaje desde el modelo antiguo al modelo optimizado
 * @param trip Viaje en formato antiguo
 * @param route Información de la ruta (con paradas)
 * @returns Datos estructurados para crear un viaje optimizado
 */
export function convertTripToOptimized(
  trip: Trip,
  route: Route & { stops?: StopsOnRoutes[] }
) {
  // Si no hay ruta o paradas, no podemos optimizar
  if (!route || !route.stops || route.stops.length < 2) {
    throw new Error("La ruta debe tener al menos dos paradas para optimizar el viaje");
  }
  
  // Ordenar las paradas por su índice
  const orderedStops = [...route.stops].sort((a, b) => a.stopIndex - b.stopIndex);
  
  // Crear datos del viaje maestro
  const tripMaster = {
    routeId: trip.routeId,
    departureDate: trip.departureDate,
    capacity: trip.capacity,
    availableSeats: trip.availableSeats,
    price: trip.price,
    departureTime: trip.departureTime,
    arrivalTime: trip.arrivalTime,
    vehicleId: trip.vehicleId,
    driverId: trip.driverId,
    companyId: trip.companyId,
    archived: trip.archived || false
  };
  
  // Crear segmentos para cada par de paradas consecutivas
  const segments = [];
  
  for (let i = 0; i < orderedStops.length - 1; i++) {
    const originStop = orderedStops[i];
    const destinationStop = orderedStops[i + 1];
    
    // Calcular hora de salida y llegada para este segmento específico
    // Esto es una simplificación; podríamos mejorar estos cálculos en el futuro
    
    segments.push({
      originStopId: originStop.stopId,
      destinationStopId: destinationStop.stopId,
      originStopIndex: originStop.stopIndex,
      destinationStopIndex: destinationStop.stopIndex,
      availableSeats: trip.capacity, // Inicialmente todos los asientos están disponibles
      price: calculateSegmentPrice(trip.price, originStop.stopIndex, destinationStop.stopIndex, orderedStops.length - 1)
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