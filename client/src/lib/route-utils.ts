/**
 * Utility functions for handling route-related operations
 */

/**
 * Determines the appropriate origin and destination for a trip
 * Prioritizes segment origin/destination over route origin/destination when available
 * 
 * @param tripData - The trip data containing origin/destination information
 * @returns An object with the determined origin and destination
 */
export function determineRouteEndpoints(tripData: any) {
  if (!tripData) {
    return { origin: null, destination: null };
  }

  // Check if trip has segment information
  const hasSegments = !!(tripData.segmentOrigin && tripData.segmentDestination);
  
  if (hasSegments) {
    // If segment origin and destination exist, use them
    return {
      origin: tripData.segmentOrigin,
      destination: tripData.segmentDestination,
      isSegment: true
    };
  } else {
    // Otherwise, use route origin and destination
    return {
      origin: tripData.route?.origin,
      destination: tripData.route?.destination,
      isSegment: false
    };
  }
}

/**
 * Formats route information for display
 * 
 * @param origin - The origin location
 * @param destination - The destination location
 * @returns Formatted string for displaying the route
 */
export function formatRouteInfo(origin: string | null | undefined, destination: string | null | undefined) {
  if (!origin || !destination) {
    return 'Ruta no disponible';
  }
  
  return `${origin}\n→ ${destination}`;
}