import { QueryClient } from "@tanstack/react-query";

// Crear un cliente de consulta con configuración optimizada para alto rendimiento
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2, // Aumentamos los reintentos a 2
      staleTime: 5 * 60 * 1000, // Datos considerados válidos por 5 minutos para mejor rendimiento
      gcTime: 30 * 60 * 1000, // Mantener en caché por 30 minutos (antes llamado cacheTime)
      // Optimizaciones adicionales para mejorar tiempos de carga
      structuralSharing: true,
      refetchInterval: false, // Desactivar refetch automático por intervalos (lo manejaremos por staleTime)
      refetchIntervalInBackground: false, // No refetch en background
    },
  },
});

// Función para pre-cargar datos importantes al iniciar la aplicación
export async function prefetchCriticalData() {
  console.log("Cargando datos críticos para toda la aplicación...");
  
  try {
    // Pre-cargar rutas (necesarias en casi todas las secciones)
    const routesPromise = queryClient.prefetchQuery({
      queryKey: ["/api/routes"],
      staleTime: 10 * 60 * 1000, // 10 minutos - las rutas cambian con muy poca frecuencia
      gcTime: 60 * 60 * 1000, // 1 hora - mantener en caché por mucho tiempo
    });
    
    await routesPromise;
    console.log("Rutas cargadas");
    
    // Pre-cargar viajes (usados en múltiples secciones) - en paralelo con reservas
    const [tripsPromise, reservationsPromise, vehiclesPromise] = await Promise.allSettled([
      // Pre-cargar viajes 
      queryClient.prefetchQuery({
        queryKey: ["/api/trips"],
        staleTime: 5 * 60 * 1000, // 5 minutos - más tiempo de caché para mejor rendimiento
        gcTime: 30 * 60 * 1000, // 30 minutos en caché
      }),
      
      // Pre-cargar reservaciones
      queryClient.prefetchQuery({
        queryKey: ["/api/reservations"],
        staleTime: 2 * 60 * 1000, // 2 minutos - más tiempo para mejorar rendimiento
        gcTime: 20 * 60 * 1000, // 20 minutos en caché
      }),
      
      // Pre-cargar vehículos
      queryClient.prefetchQuery({
        queryKey: ["/api/vehicles"],
        staleTime: 10 * 60 * 1000, // 10 minutos - los vehículos cambian muy poco
        gcTime: 60 * 60 * 1000, // 1 hora
      })
    ]);
    
    console.log("Datos críticos pre-cargados correctamente");
  } catch (error) {
    console.error("Error pre-cargando datos críticos:", error);
    // No propagar el error, permitir que la aplicación continúe
  }
}

type QueryFnOptions = {
  on401?: "throw" | "returnNull";
};

/**
 * Default fetch function for use with react-query
 * Optimizado para rendimiento con soporte para control de caché avanzado
 */
export function getQueryFn(options: QueryFnOptions = {}) {
  return async function queryFn<T>({ queryKey }: { queryKey: string[] }): Promise<T> {
    const path = queryKey[0];
    
    // Optimización: usar cache-control para mejorar rendimiento
    const fetchOptions: RequestInit = {
      headers: {
        'Cache-Control': 'max-age=300', // Sugerir al navegador cachear por 5 minutos
        'Pragma': 'no-cache'
      },
      // Las siguientes opciones ayudan a evitar recargar datos innecesariamente
      cache: 'default',
      credentials: 'same-origin'
    };
    
    try {
      const response = await fetch(path, fetchOptions);
      
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
    } catch (error) {
      console.error(`Error fetching ${path}:`, error);
      throw error;
    }
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