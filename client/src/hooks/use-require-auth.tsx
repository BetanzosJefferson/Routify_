import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { useLocation } from 'wouter';

/**
 * Hook personalizado para requerir autenticación en una página
 * Redirige al usuario a la página de inicio de sesión si no está autenticado
 */
export const useRequireAuth = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Mostrar notificación
        toast({
          title: "Acceso restringido",
          description: "Debes iniciar sesión para acceder a esta página",
          variant: "destructive",
        });
        
        // Redirigir a la página de inicio de sesión
        setLocation('/login');
      }
      setIsChecking(false);
    }
  }, [user, loading, setLocation, toast]);

  return { user, loading: loading || isChecking };
};