import { useQuery } from "@tanstack/react-query";

export interface TripBudget {
  id: number;
  tripId: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export function useTripBudget(tripId: number | null) {
  return useQuery({
    queryKey: [`/api/trips/${tripId}/budget`],
    queryFn: async () => {
      if (!tripId) return null;
      
      const response = await fetch(`/api/trips/${tripId}/budget`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Si no hay presupuesto asignado
          return null;
        }
        throw new Error('Error al obtener el presupuesto del viaje');
      }
      
      return response.json() as Promise<TripBudget>;
    },
    enabled: !!tripId
  });
}