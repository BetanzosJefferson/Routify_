import { TripWithRouteInfo } from "@shared/schema";
import { ComboboxOption } from "@/components/ui/combobox";

/**
 * Extrae y formatea ubicaciones únicas (origen y destino) de rutas y viajes
 */
export function extractLocationsFromTrips(trips: TripWithRouteInfo[]): ComboboxOption[] {
  const uniqueLocations = new Set<string>();
  
  trips.forEach(trip => {
    // Agregar origen principal de la ruta
    if (trip.route.origin) {
      uniqueLocations.add(trip.route.origin);
    }
    
    // Agregar destino principal de la ruta
    if (trip.route.destination) {
      uniqueLocations.add(trip.route.destination);
    }
    
    // Agregar paradas intermedias
    if (trip.route.stops && Array.isArray(trip.route.stops)) {
      trip.route.stops.forEach(stop => {
        if (stop) uniqueLocations.add(stop);
      });
    }
    
    // Si es un sub-viaje, agregar origen y destino del segmento
    if (trip.isSubTrip) {
      if (trip.segmentOrigin) uniqueLocations.add(trip.segmentOrigin);
      if (trip.segmentDestination) uniqueLocations.add(trip.segmentDestination);
    }
  });
  
  // Convertir a formato de opciones para combobox
  return Array.from(uniqueLocations)
    .sort()
    .map(location => ({
      value: location,
      label: formatLocationName(location)
    }));
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

/**
 * Busca y filtra ubicaciones basadas en un texto de búsqueda
 */
export function filterLocations(locations: ComboboxOption[], searchText: string): ComboboxOption[] {
  if (!searchText) return locations;
  
  const searchLower = searchText.toLowerCase();
  return locations.filter(location => 
    location.label.toLowerCase().includes(searchLower) || 
    location.value.toLowerCase().includes(searchLower)
  );
}