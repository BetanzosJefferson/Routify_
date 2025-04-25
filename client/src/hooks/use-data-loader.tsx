import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { queryClient, prefetchCriticalData } from '@/lib/queryClient';

// Define los estados posibles del cargador de datos con información adicional
type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

// Interface para el contexto con métricas de rendimiento
interface DataLoaderContextType {
  loadingState: LoadingState;
  isCriticalDataReady: boolean;
  refetchAllData: () => Promise<void>;
  // Métricas para monitoreo de rendimiento
  lastLoadTime?: number;
  performanceMetrics: {
    loadStartTime?: number;
    loadEndTime?: number;
    totalLoadTime?: number;
  };
}

// Crear el contexto
const DataLoaderContext = createContext<DataLoaderContextType | null>(null);

// Hook optimizado para usar el contexto
export function useDataLoader() {
  const context = useContext(DataLoaderContext);
  if (!context) {
    throw new Error('useDataLoader debe usarse dentro de un DataLoaderProvider');
  }
  return context;
}

// Props para el proveedor
interface DataLoaderProviderProps {
  children: ReactNode;
}

// Constantes para optimizar carga
const STORAGE_CACHE_KEY = 'transroute_cache_timestamp';
const CACHE_VALIDITY_DURATION = 30 * 60 * 1000; // 30 minutos

// Proveedor del contexto optimizado para rendimiento
export function DataLoaderProvider({ children }: DataLoaderProviderProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [isCriticalDataReady, setIsCriticalDataReady] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    loadStartTime?: number;
    loadEndTime?: number;
    totalLoadTime?: number;
  }>({});
  
  // Función para verificar si hay datos en caché válidos
  const checkCacheValidity = (): boolean => {
    try {
      const cachedTimestamp = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();
        // Si el caché es válido (menos de 30 minutos de antigüedad)
        if (now - timestamp < CACHE_VALIDITY_DURATION) {
          return true;
        }
      }
      return false;
    } catch (e) {
      // Error al acceder a localStorage (modo incógnito, etc.)
      return false;
    }
  };
  
  // Función para actualizar el timestamp del caché
  const updateCacheTimestamp = () => {
    try {
      localStorage.setItem(STORAGE_CACHE_KEY, Date.now().toString());
    } catch (e) {
      // Error al escribir en localStorage, ignorar
    }
  };
  
  // Función para recargar todos los datos críticos de manera optimizada
  const refetchAllData = async () => {
    try {
      const startTime = performance.now();
      setPerformanceMetrics(prev => ({ ...prev, loadStartTime: startTime }));
      
      setLoadingState('loading');
      await prefetchCriticalData();
      
      const endTime = performance.now();
      updateCacheTimestamp();
      
      setLoadingState('ready');
      setIsCriticalDataReady(true);
      setPerformanceMetrics(prev => ({
        ...prev,
        loadEndTime: endTime,
        totalLoadTime: endTime - startTime
      }));
    } catch (error) {
      console.error('Error recargando datos críticos:', error);
      setLoadingState('error');
    }
  };
  
  // Efecto para cargar datos iniciales, optimizado con cache local
  useEffect(() => {
    // Solo cargar si está en estado inicial
    if (loadingState === 'idle') {
      // Iniciamos la carga de datos
      setLoadingState('loading');
      
      const startTime = performance.now();
      setPerformanceMetrics(prev => ({ ...prev, loadStartTime: startTime }));
      
      // Verificar si hay datos en caché válidos para un inicio rápido
      const hasCachedData = checkCacheValidity();
      
      // Intentar cargar los datos críticos
      prefetchCriticalData()
        .then(() => {
          // Actualizar cache después de éxito
          updateCacheTimestamp();
          
          const endTime = performance.now();
          setPerformanceMetrics(prev => ({
            ...prev,
            loadEndTime: endTime,
            totalLoadTime: endTime - startTime
          }));
          
          // Marcamos los datos como listos
          setLoadingState('ready');
          setIsCriticalDataReady(true);
        })
        .catch((error) => {
          console.error('Error cargando datos críticos:', error);
          setLoadingState('error');
        });
    }
  }, [loadingState]);
  
  // Optimización: uso de useMemo para evitar re-renders innecesarios del contexto
  const contextValue = useMemo<DataLoaderContextType>(() => ({
    loadingState,
    isCriticalDataReady,
    refetchAllData,
    lastLoadTime: performanceMetrics.loadEndTime,
    performanceMetrics
  }), [loadingState, isCriticalDataReady, performanceMetrics]);
  
  return (
    <DataLoaderContext.Provider value={contextValue}>
      {children}
    </DataLoaderContext.Provider>
  );
}