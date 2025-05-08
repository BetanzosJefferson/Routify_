import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { Route } from "@shared/schema";

/**
 * Hook para obtener todas las rutas disponibles
 */
export function useRoutes() {
  const { user } = useAuth();
  
  return useQuery<Route[]>({
    queryKey: ["/api/routes"],
    enabled: !!user,
    staleTime: 60000, // 1 minuto
    refetchInterval: false,
    queryFn: async () => {
      try {
        console.log("Cargando rutas...");
        const response = await fetch("/api/routes");
        
        if (!response.ok) {
          throw new Error(`Error al obtener rutas: ${response.statusText}`);
        }
        
        const routes = await response.json();
        console.log("Rutas cargadas:", routes);
        return routes;
      } catch (error) {
        console.error("Error al cargar rutas:", error);
        throw error;
      }
    }
  });
}