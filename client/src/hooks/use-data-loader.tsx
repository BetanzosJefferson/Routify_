import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { queryClient, prefetchCriticalData } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

// Define los estados posibles del cargador de datos
type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

// Interface para el contexto
interface DataLoaderContextType {
  loadingState: LoadingState;
  isCriticalDataReady: boolean;
  loadingProgress: number;
  loadingMessage: string;
  refetchAllData: () => Promise<void>;
  isDataLoading: boolean;
}

// Crear el contexto con valores por defecto
const DataLoaderContext = createContext<DataLoaderContextType>({
  loadingState: 'idle',
  isCriticalDataReady: false,
  loadingProgress: 0,
  loadingMessage: '',
  refetchAllData: async () => {},
  isDataLoading: true,
});

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

// Proveedor del contexto optimizado con mejor manejo de estados
export function DataLoaderProvider({ children }: DataLoaderProviderProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [isCriticalDataReady, setIsCriticalDataReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando carga de datos...');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Calculamos un estado derivado para simplificar chequeos
  const isDataLoading = loadingState === 'loading' || loadingState === 'idle';
  
  // Función para actualizar progreso y mensaje
  const updateProgress = useCallback((progress: number, message: string) => {
    setLoadingProgress(progress);
    setLoadingMessage(message);
  }, []);
  
  // Función optimizada para cargar datos
  const loadData = useCallback(async () => {
    try {
      setLoadingState('loading');
      updateProgress(10, 'Cargando datos de rutas...');
      
      // Cargamos datos críticos con manejo de progreso
      const success = await prefetchCriticalData();
      
      if (success) {
        updateProgress(100, 'Datos cargados correctamente');
        setLoadingState('ready');
        setIsCriticalDataReady(true);
      } else {
        updateProgress(100, 'Error en la carga de datos');
        setLoadingState('error');
      }
    } catch (error) {
      console.error('Error en la carga de datos críticos:', error);
      updateProgress(100, 'Error en la carga de datos');
      setLoadingState('error');
    } finally {
      // Indicamos que la carga inicial ha terminado
      setIsInitialLoad(false);
    }
  }, [updateProgress]);
  
  // Función para recargar todos los datos críticos (expuesta al usuario)
  const refetchAllData = useCallback(async () => {
    await loadData();
  }, [loadData]);
  
  // Efecto para cargar datos iniciales una sola vez al montar el componente
  useEffect(() => {
    if (isInitialLoad) {
      loadData();
    }
  }, [isInitialLoad, loadData]);
  
  // Objeto del contexto con valores optimizados
  const contextValue: DataLoaderContextType = {
    loadingState,
    isCriticalDataReady,
    loadingProgress,
    loadingMessage,
    refetchAllData,
    isDataLoading
  };
  
  // Renderizado condicional: mostrar un loader solo en la carga inicial
  if (isInitialLoad && isDataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cargando TransRoute</h2>
        <p className="text-muted-foreground mb-4">{loadingMessage}</p>
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      </div>
    );
  }
  
  return (
    <DataLoaderContext.Provider value={contextValue}>
      {children}
    </DataLoaderContext.Provider>
  );
}