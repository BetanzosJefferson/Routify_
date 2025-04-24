import { TripWithRouteInfo } from "@shared/schema";
import { LocationOption } from "@/components/ui/command-combobox";

/**
 * Extrae y formatea ubicaciones únicas (origen y destino) de rutas y viajes en formato agrupado por ciudad
 */
export function extractLocationsFromTrips(trips: TripWithRouteInfo[]): LocationOption[] {
  const locationMap = new Map<string, LocationOption>();
  
  trips.forEach(trip => {
    const mainRoute = trip.route;
    
    // Procesar el origen principal de la ruta
    if (mainRoute && mainRoute.origin) {
      processLocation(mainRoute.origin, locationMap);
    }
    
    // Procesar el destino principal de la ruta
    if (mainRoute && mainRoute.destination) {
      processLocation(mainRoute.destination, locationMap);
    }
    
    // Procesar paradas intermedias
    if (mainRoute && mainRoute.stops && Array.isArray(mainRoute.stops)) {
      mainRoute.stops.forEach(stop => {
        if (stop) processLocation(stop, locationMap);
      });
    }
    
    // Si es un sub-viaje, procesar origen y destino del segmento
    if (trip.isSubTrip) {
      if (trip.segmentOrigin) processLocation(trip.segmentOrigin, locationMap);
      if (trip.segmentDestination) processLocation(trip.segmentDestination, locationMap);
    }
  });
  
  // Convertir el mapa a un array de opciones
  return Array.from(locationMap.values());
}

/**
 * Procesa una ubicación y la añade al mapa, detectando ciudad y lugar específico
 */
function processLocation(location: string, locationMap: Map<string, LocationOption>): void {
  // Si ya existe esta ubicación exacta en el mapa, no la procesamos de nuevo
  if (locationMap.has(location)) return;
  
  // Intentamos extraer la ciudad y el lugar específico
  const parts = parseLocationString(location);
  
  // Creamos la opción de ubicación
  const locationOption: LocationOption = {
    city: parts.city,
    place: parts.place,
    value: location
  };
  
  // Añadimos opción "Todas las paradas" por ciudad si no existe
  const cityKey = `${parts.city}:all`;
  if (!locationMap.has(cityKey)) {
    locationMap.set(cityKey, {
      city: parts.city,
      place: "Todas las paradas",
      value: parts.city
    });
  }
  
  // Añadimos la ubicación específica
  locationMap.set(location, locationOption);
}

/**
 * Analiza una cadena de ubicación para extraer la ciudad y el lugar específico
 */
function parseLocationString(location: string): { city: string, place: string } {
  // Patrones comunes en las ubicaciones
  const cityPatterns = [
    // Patrón: "Ciudad - Lugar Específico"
    /^([\wáéíóúüñÁÉÍÓÚÜÑ\s]+)\s*-\s*([\wáéíóúüñÁÉÍÓÚÜÑ\s,]+)$/,
    
    // Patrón: "Lugar Específico, Ciudad"
    /^([\wáéíóúüñÁÉÍÓÚÜÑ\s]+),\s*([\wáéíóúüñÁÉÍÓÚÜÑ\s]+)$/,
    
    // Patrón específico para "Acapulco de Juárez, Guerrero - Terminal Condesa"
    /^([\wáéíóúüñÁÉÍÓÚÜÑ\s]+(?:, [\wáéíóúüñÁÉÍÓÚÜÑ\s]+)?)\s*-\s*([\wáéíóúüñÁÉÍÓÚÜÑ\s,]+)$/,
  ];
  
  for (const pattern of cityPatterns) {
    const match = location.match(pattern);
    if (match) {
      // El primer grupo suele ser la ciudad, el segundo el lugar específico
      // pero a veces es al revés dependiendo del patrón
      if (pattern.toString().includes(",\\s*([\\w")) {
        // Para el patrón "Lugar, Ciudad"
        return {
          city: match[2].trim(),
          place: match[1].trim()
        };
      } else {
        // Para los patrones "Ciudad - Lugar"
        return {
          city: match[1].trim(),
          place: match[2].trim()
        };
      }
    }
  }
  
  // Si no detectamos patrón, consideramos todo como el lugar y extraemos una posible ciudad
  const words = location.split(/\s+/);
  if (words.length > 1) {
    const city = words[0]; // Primera palabra como ciudad
    return {
      city: city,
      place: location
    };
  }
  
  // Si todo falla, usamos la ubicación completa para ambos campos
  return {
    city: location,
    place: location
  };
}

/**
 * Función para abreviar nombres de ubicación que son demasiado largos
 */
export function formatLocationName(location: string): string {
  // Si la ubicación tiene más de 30 caracteres, abreviarla
  if (location.length > 30) {
    // Dividir por guiones, comas o similares para identificar partes
    const parts = location.split(/\s*[-,]\s*/);
    
    if (parts.length > 1) {
      // Si hay partes separadas por guiones o comas, usamos la primera parte
      // y agregamos puntos suspensivos
      return parts[0] + " (...)";
    } else {
      // Si es solo texto largo sin separadores claros, truncamos
      return location.substring(0, 27) + "...";
    }
  }
  
  return location;
}