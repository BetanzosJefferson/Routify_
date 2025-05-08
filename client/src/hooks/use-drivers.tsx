import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const { data: drivers = [], isLoading, error } = useQuery({
    queryKey: ['/api/users', 'chofer'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/users?role=chofer');
        if (!res.ok) {
          throw new Error('No se pudieron obtener los conductores');
        }
        const data = await res.json();
        // Filtramos explícitamente para asegurarnos de que solo se incluyan usuarios con rol 'chofer'
        return data.filter((user: Driver) => user.role === 'chofer');
      } catch (error) {
        console.error('Error al obtener conductores:', error);
        throw error;
      }
    }
  });

  return { drivers, isLoading, error };
}