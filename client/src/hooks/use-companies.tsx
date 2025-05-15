import { useQuery } from "@tanstack/react-query";
import { Company } from "@shared/schema";

// Hook para obtener todas las empresas
export function useCompanies(forTransfer: boolean = false) {
  return useQuery({
    queryKey: ['/api/companies', forTransfer ? 'transfer' : 'all'],
    queryFn: async () => {
      const url = forTransfer ? '/api/companies?forTransfer=true' : '/api/companies';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al obtener empresas');
      }
      
      const data = await response.json();
      return data as Company[];
    }
  });
}