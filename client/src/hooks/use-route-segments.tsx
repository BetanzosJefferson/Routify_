import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

/**
 * Hook para obtener los segmentos de una ruta específica
 * @param routeId ID de la ruta
 */
export function useRouteSegments(routeId?: number) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["/api/routes", routeId, "segments"],
    enabled: !!user && !!routeId,
    staleTime: 300000, // 5 minutos
    refetchInterval: false,
    queryFn: async () => {
      if (!routeId) {
        throw new Error("ID de ruta no proporcionado");
      }
      
      try {
        const response = await fetch(`/api/routes/${routeId}/segments`);
        
        if (!response.ok) {
          throw new Error(`Error al obtener segmentos: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error al cargar segmentos para ruta ${routeId}:`, error);
        throw error;
      }
    }
  });
}