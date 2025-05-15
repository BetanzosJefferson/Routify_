import { useQuery } from "@tanstack/react-query";
import { Company } from "@shared/schema";

/**
 * Hook para obtener las compañías registradas en el sistema
 * @param forTransfer - Si es true, sólo devuelve las compañías disponibles para transferencia
 * @returns Query result con las compañías registradas
 */
export function useCompanies(forTransfer: boolean = false) {
  const endpoint = forTransfer 
    ? "/api/companies?forTransfer=true" 
    : "/api/companies";

  return useQuery<Company[]>({
    queryKey: ["companies", { forTransfer }],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error("Error al obtener las compañías");
      }
      return response.json();
    },
  });
}