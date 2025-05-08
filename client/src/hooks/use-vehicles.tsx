import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface Vehicle {
  id: number;
  plates: string;
  brand: string;
  model: string;
  companyId: string | null;
}

/**
 * Hook para obtener los vehículos disponibles
 */
export function useVehicles() {
  const { user } = useAuth();
  
  return useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    enabled: !!user,
    staleTime: 60000, // 1 minuto
    refetchInterval: false,
    queryFn: async () => {
      try {
        const response = await fetch("/api/vehicles");
        
        if (!response.ok) {
          throw new Error(`Error al obtener vehículos: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error al cargar vehículos:", error);
        throw error;
      }
    }
  });
}