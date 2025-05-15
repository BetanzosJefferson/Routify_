import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import { useWebSocket } from '@/hooks/use-websocket';
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
  const { playNotificationSound } = useNotificationSound();
  
  // Consulta de notificaciones
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    // Reducir la frecuencia de refetch ya que ahora usamos WebSocket
    refetchInterval: 60000,
    // Solo consultar si el usuario está autenticado
    enabled: !!user,
  });
  
  // Manejador de mensajes WebSocket
  const handleWebSocketMessage = (data: any) => {
    // Registrar todos los mensajes WebSocket para depuración
    console.log('[WebSocket] Mensaje recibido:', data);
    
    if (data.type === 'notification') {
      console.log('[WebSocket] NOTIFICACIÓN RECIBIDA', data.data);
      
      try {
        // Reproducir sonido de notificación - llamar esto primero para mejorar la experiencia
        console.log('[Notificación] Intentando reproducir sonido...');
        
        // IMPORTANTE: Usar setTimeout para asegurar que el sonido se reproduzca después de un breve retraso
        // Esto ayuda en navegadores que requieren interacción del usuario antes de reproducir audio
        setTimeout(() => {
          playNotificationSound();
          console.log('[Notificación] Llamada de reproducción de sonido ejecutada');
        }, 100);
        
        // Extraer el mensaje de la notificación - aceptar diferentes estructuras
        const notification = data.data;
        let title = notification.title || 'Nueva notificación';
        let message = notification.message || 'Has recibido una nueva notificación';
        let notificationType = notification.type || 'default';
        let createdAt = notification.createdAt || new Date().toISOString();
        
        console.log('[Notificación] Datos procesados:', {
          title, message, notificationType, createdAt
        });
        
        // Formatear fecha
        const formattedDate = format(new Date(createdAt), 'HH:mm', { locale: es });
        
        // Mostrar notificación en toast con un pequeño retraso
        // para que no compita con la reproducción del sonido
        setTimeout(() => {
          toast({
            title: title,
            description: (
              <div className="flex flex-col space-y-1">
                <p className="text-sm">{message}</p>
                <p className="text-xs text-muted-foreground">{formattedDate}</p>
              </div>
            ),
            variant: notificationType === 'error' ? 'destructive' : 'default',
            duration: 8000, // Más tiempo para que el usuario pueda ver la notificación
          });
        }, 300);
        
        // Actualizar la caché de datos
        console.log('[Notificación] Actualizando caché de notificaciones');
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      } catch (error) {
        console.error('[Notificación] Error al procesar notificación:', error);
      }
    }
  };
  
  // Inicializar WebSocket
  const { status: wsStatus } = useWebSocket({
    onMessage: handleWebSocketMessage,
    debug: true,
    autoReconnect: true
  });
  
  // Efecto para mostrar notificaciones existentes al cargar
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
      
      // Si hay notificaciones nuevas, reproducir sonido una vez
      if (newNotifications.length > 0) {
        // Reproducir sonido sólo una vez, independientemente del número de notificaciones
        playNotificationSound();
        
        console.log(`Recibidas ${newNotifications.length} notificaciones nuevas`);
      }
      
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
  }, [notifications, toast, queryClient, playNotificationSound]);
  
  return { 
    notifications,
    wsStatus
  };
}