import { useQuery } from "@tanstack/react-query";

export interface TripExpense {
  id: number;
  tripId: number;
  type: string;
  category?: string; // Alias para type en el frontend
  amount: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  companyId?: string;
  userId?: number;
  createdBy?: string;
}

// Hook para obtener los gastos de un viaje específico
export function useTripExpenses(tripId: number | undefined) {
  return useQuery({
    queryKey: ["expenses", tripId],
    queryFn: async () => {
      if (!tripId) return [];
      
      try {
        const response = await fetch(`/api/trips/${tripId}/expenses`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Error al obtener los gastos del viaje");
        }
        
        const data = await response.json();
        
        // Mapear los gastos para que tengan la propiedad 'category' como alias de 'type'
        // para mantener compatibilidad con el componente de la lista de gastos
        return data.map((expense: any) => ({
          ...expense,
          category: expense.type // Añadir 'category' como alias de 'type'
        }));
      } catch (error) {
        console.error("Error al cargar los gastos:", error);
        throw error;
      }
    },
    enabled: !!tripId
  });
}