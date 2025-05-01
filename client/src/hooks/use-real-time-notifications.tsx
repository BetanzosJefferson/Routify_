import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Interfaz para el tipo de notificación
interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  userId: number;
  relatedId: number | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useRealTimeNotifications() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastNotificationIdRef = useRef<number | null>(null);
  
  // Consulta de notificaciones
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    // Refetch automático cada 30 segundos
    refetchInterval: 30000,
    // Solo consultar si el usuario está autenticado
    enabled: !!user,
  });
  
  // Efecto para mostrar notificaciones nuevas
  useEffect(() => {
    if (!notifications || !notifications.length) return;
    
    // Ordenar notificaciones por ID (asumiendo que IDs más altos son más recientes)
    const sortedNotifications = [...notifications].sort((a, b) => b.id - a.id);
    const latestNotification = sortedNotifications[0];
    
    // Si es la primera carga, guardar el ID más reciente sin mostrar toast
    if (lastNotificationIdRef.current === null) {
      lastNotificationIdRef.current = latestNotification.id;
      return;
    }
    
    // Si hay una notificación más reciente que la última que vimos
    if (latestNotification.id > lastNotificationIdRef.current) {
      // Buscar todas las notificaciones nuevas
      const newNotifications = sortedNotifications.filter(
        n => n.id > (lastNotificationIdRef.current || 0) && !n.read
      );
      
      // Actualizar el ID de referencia
      lastNotificationIdRef.current = latestNotification.id;
      
      // Mostrar toast para cada notificación nueva (limitado a 3 para evitar spam)
      newNotifications.slice(0, 3).forEach(notification => {
        const formattedDate = format(new Date(notification.createdAt), 'HH:mm', { locale: es });
        
        toast({
          title: notification.title,
          description: (
            <div className="flex flex-col space-y-1">
              <p className="text-sm">{notification.message}</p>
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>
          ),
          variant: notification.type === 'error' ? 'destructive' : 'default',
          duration: 5000,
        });
      });
      
      // Actualizar el contador de notificaciones no leídas
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    }
  }, [notifications, toast, queryClient]);
  
  return { notifications };
}