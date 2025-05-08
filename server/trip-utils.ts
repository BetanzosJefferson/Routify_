import { SegmentPrice } from "@shared/schema";

/**
 * Determina si dos ubicaciones pertenecen a la misma ciudad
 * Ejemplo: "Monterrey, NL - Centro" y "Monterrey, NL - Terminal" son de la misma ciudad
 * @param location1 Primera ubicación
 * @param location2 Segunda ubicación
 * @returns true si ambas ubicaciones pertenecen a la misma ciudad
 */
export function isSameCity(location1: string, location2: string): boolean {
  // Validar que ambas ubicaciones tienen el formato esperado
  if (!location1.includes(' - ') || !location2.includes(' - ')) {
    console.warn(`Formato de ubicación inesperado: "${location1}" o "${location2}"`);
    return false;
  }
  
  // Extract city name (assuming format "City, State - Location")
  const city1 = location1.split(' - ')[0].trim();
  const city2 = location2.split(' - ')[0].trim();
  
  return city1 === city2;
}

/**
 * Calcula un precio proporcional basado en la distancia de un segmento
 * dentro de una ruta completa
 * @param segment Segmento para el cual calcular el precio
 * @param routeInfo Información de la ruta completa
 * @param totalPrice Precio total de la ruta completa
 * @returns Precio proporcional calculado
 */
export function calculateProportionalPrice(
  segment: { origin: string; destination: string; price: number },
  routeInfo: { origin: string; destination: string; stops: string[] },
  totalPrice: number
): number {
  // Si el segmento ya tiene un precio definido, usarlo
  if (segment.price > 0) {
    return segment.price;
  }
  
  const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
  
  // Encontrar índices de las paradas
  const originIndex = allStops.indexOf(segment.origin);
  const destIndex = allStops.indexOf(segment.destination);
  
  if (originIndex === -1 || destIndex === -1 || originIndex >= destIndex) {
    console.error(`Segmento inválido: ${segment.origin} -> ${segment.destination}`);
    return Math.round(totalPrice * 0.4); // Valor predeterminado si hay error
  }
  
  // Calcular proporción basada en la cantidad de segmentos
  const totalSegments = allStops.length - 1;
  const segmentsCovered = destIndex - originIndex;
  const proportion = segmentsCovered / totalSegments;
  
  // Aplicar una curva no lineal para que los segmentos cortos no sean demasiado baratos
  const adjustedProportion = Math.pow(proportion, 0.85);
  
  // Aplicar un factor mínimo para evitar precios demasiado bajos
  const minProportion = 0.2;
  const finalProportion = Math.max(adjustedProportion, minProportion * segmentsCovered);
  
  return Math.round(totalPrice * finalProportion);
}

/**
 * Calcula tiempos aproximados para cada segmento de un viaje
 * basado en los tiempos de salida y llegada del viaje completo
 * @param segmentPrices Lista de segmentos con precios
 * @param departureTime Hora de salida del viaje completo
 * @param arrivalTime Hora de llegada del viaje completo
 * @returns Lista de segmentos con tiempos calculados
 */
export function calculateSegmentTimes(
  segmentPrices: SegmentPrice[],
  departureTime: string,
  arrivalTime: string
): SegmentPrice[] {
  // Implementación pendiente - por ahora solo retornamos los mismos segmentos
  return segmentPrices;
}

/**
 * Genera todos los segmentos posibles entre paradas
 * @param stops Lista de paradas en orden
 * @returns Lista de todos los pares posibles origen-destino
 */
export function generateAllPossibleSegments(stops: string[]): { origin: string; destination: string }[] {
  const segments = [];
  
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      segments.push({
        origin: stops[i],
        destination: stops[j]
      });
    }
  }
  
  return segments;
}