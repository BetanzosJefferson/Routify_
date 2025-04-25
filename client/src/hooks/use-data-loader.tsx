import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { queryClient, prefetchCriticalData } from '@/lib/queryClient';

// Define los estados posibles del cargador de datos
type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

// Interface para el contexto
interface DataLoaderContextType {
  loadingState: LoadingState;
  isCriticalDataReady: boolean;
  refetchAllData: () => Promise<void>;
}

// Crear el contexto
const DataLoaderContext = createContext<DataLoaderContextType | null>(null);

// Hook personalizado para usar el contexto
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

// Proveedor del contexto
export function DataLoaderProvider({ children }: DataLoaderProviderProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [isCriticalDataReady, setIsCriticalDataReady] = useState(false);
  
  // Función para recargar todos los datos críticos
  const refetchAllData = async () => {
    try {
      setLoadingState('loading');
      await prefetchCriticalData();
      setLoadingState('ready');
      setIsCriticalDataReady(true);
    } catch (error) {
      console.error('Error recargando datos críticos:', error);
      setLoadingState('error');
    }
  };
  
  // Efecto para cargar datos iniciales
  useEffect(() => {
    // Solo cargar si está en estado inicial
    if (loadingState === 'idle') {
      // Iniciamos la carga de datos
      setLoadingState('loading');
      
      // Intentar cargar los datos críticos
      prefetchCriticalData()
        .then(() => {
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
  
  // Objeto del contexto
  const contextValue: DataLoaderContextType = {
    loadingState,
    isCriticalDataReady,
    refetchAllData,
  };
  
  return (
    <DataLoaderContext.Provider value={contextValue}>
      {children}
    </DataLoaderContext.Provider>
  );
}