import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  stops: string[];
  companyId?: string;
}

/**
 * Hook para obtener las rutas disponibles
 */
export function useRoutes() {
  const { data: routes = [], isLoading, error } = useQuery({
    queryKey: ['/api/routes'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/routes');
        if (!res.ok) {
          throw new Error('No se pudieron obtener las rutas');
        }
        return await res.json();
      } catch (error) {
        console.error('Error al obtener rutas:', error);
        throw error;
      }
    }
  });

  return { routes, isLoading, error };
}