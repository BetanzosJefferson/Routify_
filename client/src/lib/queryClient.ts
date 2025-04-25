import { QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

// Crear un cliente de consulta con configuración optimizada
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2, 
      staleTime: 2 * 60 * 1000, // Aumentamos a 2 minutos para minimizar peticiones frecuentes
      gcTime: 15 * 60 * 1000, // Mantener en caché por 15 minutos (antes llamado cacheTime)
      structuralSharing: true,
    },
  },
});

/**
 * Función para obtener todos los datos necesarios para la aplicación,
 * optimizada para reducir tiempos de carga y asegurar disponibilidad
 * de datos en todas las secciones sin depender del orden de navegación.
 */
export async function prefetchCriticalData() {
  try {
    console.log("Cargando datos críticos para toda la aplicación...");
    
    // Preparar fecha actual para filtros recurrentes
    const today = new Date();
    const todayFormatted = format(today, 'yyyy-MM-dd');
    
    // 1. Pre-cargar rutas (necesarias en casi todas las secciones) con alta prioridad
    const routesPromise = queryClient.prefetchQuery({
      queryKey: ["/api/routes"],
      staleTime: 10 * 60 * 1000, // 10 minutos - las rutas cambian con poca frecuencia
    });
    
    // Esperamos a que las rutas estén disponibles primero
    await routesPromise;
    console.log("Rutas cargadas");
    
    // Cargamos el resto de datos en paralelo para optimizar tiempos
    await Promise.all([
      // 2. Pre-cargar viajes (usados en múltiples secciones)
      queryClient.prefetchQuery({
        queryKey: ["/api/trips"],
        staleTime: 3 * 60 * 1000, // 3 minutos - los viajes pueden cambiar más
      }),
      
      // 3. Pre-cargar viajes del día actual (para lista de abordaje)
      queryClient.prefetchQuery({
        queryKey: [`/api/trips?date=${todayFormatted}`],
        staleTime: 2 * 60 * 1000,
      }),
      
      // 4. Pre-cargar reservaciones (necesarias en varias secciones)
      queryClient.prefetchQuery({
        queryKey: ["/api/reservations"],
        staleTime: 2 * 60 * 1000, // 2 minutos - las reservaciones cambian con frecuencia
      }),
      
      // 5. Pre-cargar datos de usuario (necesarios para permisos)
      queryClient.prefetchQuery({
        queryKey: ["/api/user"],
        staleTime: 5 * 60 * 1000, // 5 minutos - datos de usuario cambian con poca frecuencia
        gcTime: 10 * 60 * 1000,
      }),
    ]);
    
    console.log("Datos críticos pre-cargados correctamente");
    return true;
  } catch (error) {
    console.error("Error pre-cargando datos críticos:", error);
    // No propagar el error, permitir que la aplicación continúe
    return false;
  }
}

type QueryFnOptions = {
  on401?: "throw" | "returnNull";
};

/**
 * Default fetch function for use with react-query
 */
export function getQueryFn(options: QueryFnOptions = {}) {
  return async function queryFn<T>({ queryKey }: { queryKey: string[] }): Promise<T> {
    const path = queryKey[0];
    const response = await fetch(path);

    if (!response.ok) {
      if (response.status === 401 && options.on401 === "returnNull") {
        return null as T;
      }
      
      // Try to get error message from response
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        if (error.message || error.error) {
          errorMessage = error.message || error.error;
        }
      } catch (e) {
        // If we can't parse the error, just use the status text
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  };
}

/**
 * Helper function for API requests with proper error handling
 */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  data?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  // Los códigos 2xx indican éxito, incluyendo el 204 (No Content)
  if (!response.ok) {
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      if (error.message || error.error) {
        errorMessage = error.message || error.error;
      }
    } catch (e) {
      // If we can't parse the error, just use the status text
    }
    
    throw new Error(errorMessage);
  }

  return response;
}