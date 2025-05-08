import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const { data: vehicles = [], isLoading, error } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/vehicles');
        if (!res.ok) {
          throw new Error('No se pudieron obtener los vehículos');
        }
        return await res.json();
      } catch (error) {
        console.error('Error al obtener vehículos:', error);
        throw error;
      }
    }
  });

  return { vehicles, isLoading, error };
}