import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface RouteSegment {
  id: number;
  routeId: number;
  origin: string;
  destination: string;
  order: number;
}

/**
 * Hook para obtener y manipular segmentos de rutas
 */
export function useRouteSegments() {
  const { data: segments = [], isLoading, error } = useQuery({
    queryKey: ['/api/route-segments'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/route-segments');
        if (!res.ok) {
          throw new Error('No se pudieron obtener los segmentos de rutas');
        }
        return await res.json();
      } catch (error) {
        console.error('Error al obtener segmentos de rutas:', error);
        throw error;
      }
    }
  });

  /**
   * Obtiene los segmentos de una ruta específica
   */
  const getSegmentsForRoute = (routeId: number) => {
    return segments.filter((segment: RouteSegment) => segment.routeId === routeId);
  };

  return { segments, getSegmentsForRoute, isLoading, error };
}