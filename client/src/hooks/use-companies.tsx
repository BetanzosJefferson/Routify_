import { useQuery } from "@tanstack/react-query";
import { Company } from "@shared/schema";

/**
 * Hook para obtener las compañías registradas en el sistema
 * @param forTransfer - Si es true, sólo devuelve las compañías disponibles para transferencia
 * @returns Query result con las compañías registradas
 */
export function useCompanies(forTransfer: boolean = false) {
  const endpoint = forTransfer 
    ? "/api/companies/transfer" // Usando el nuevo endpoint específico para transferencias
    : "/api/companies";

  return useQuery<Company[]>({
    queryKey: ["companies", { forTransfer }],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        console.error(`Error al obtener las compañías: ${response.statusText} (${response.status})`);
        throw new Error(`Error al obtener las compañías: ${response.statusText}`);
      }
      return response.json();
    },
    retry: forTransfer ? 3 : 1, // Más reintentos para el endpoint de transferencia
  });
}