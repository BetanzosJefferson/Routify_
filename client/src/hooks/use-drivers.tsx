import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string | null;
}

/**
 * Hook para obtener los conductores disponibles
 */
export function useDrivers() {
  const { user } = useAuth();
  
  return useQuery<Driver[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
    staleTime: 60000, // 1 minuto
    refetchInterval: false,
    queryFn: async () => {
      try {
        // Filtrar solo por usuarios con rol de chofer
        const response = await fetch("/api/users?role=chofer");
        
        if (!response.ok) {
          throw new Error(`Error al obtener conductores: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error al cargar conductores:", error);
        throw error;
      }
    }
  });
}