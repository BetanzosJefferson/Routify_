import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';

type NotificationMessage = {
  id: number;
  type: string;
  title: string;
  message: string;
  details?: string[];
  timestamp: string;
  [key: string]: any; // Para permitir otros campos específicos del tipo de notificación
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Hook para manejar la conexión WebSocket para notificaciones en tiempo real
 */
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  
  // Función para conectar al WebSocket
  const connect = useCallback(() => {
    if (!user || !user.id) {
      console.warn('No hay usuario autenticado para conectar WebSocket');
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket ya está conectado');
      return;
    }
    
    try {
      setStatus('connecting');
      
      // Crear la URL del WebSocket con el protocolo adecuado
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      // Crear la conexión WebSocket
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('WebSocket conectado');
        setStatus('connected');
        
        // Enviar información de autenticación
        socket.send(JSON.stringify({
          type: 'auth',
          userId: user.id,
          companyId: user.companyId || user.company
        }));
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'auth_success') {
            console.log('Autenticación WebSocket exitosa');
          } 
          else if (data.type === 'notification') {
            // Añadir nueva notificación al estado
            setNotifications(prev => [data.data, ...prev].slice(0, 50)); // Limitar a 50 notificaciones
            
            // Mostrar notificación nativa del navegador si está permitido
            if (Notification.permission === 'granted') {
              new Notification(data.data.title, {
                body: data.data.message,
                icon: '/logo.png'
              });
            }
          }
        } catch (error) {
          console.error('Error al procesar mensaje WebSocket:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error('Error en conexión WebSocket:', error);
        setStatus('error');
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket desconectado: ${event.code} - ${event.reason}`);
        setStatus('disconnected');
        
        // Reconectar después de un tiempo si no fue un cierre limpio
        if (event.code !== 1000) {
          setTimeout(() => {
            connect();
          }, 5000);
        }
      };
      
      wsRef.current = socket;
    } catch (error) {
      console.error('Error al establecer conexión WebSocket:', error);
      setStatus('error');
    }
  }, [user]);
  
  // Función para desconectar el WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, 'Desconexión manual');
      wsRef.current = null;
      setStatus('disconnected');
    }
  }, []);
  
  // Conectar cuando el usuario está autenticado
  useEffect(() => {
    if (user && user.id) {
      connect();
    } else {
      disconnect();
    }
    
    // Cleanup al desmontar el componente
    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);
  
  // Solicitar permiso para notificaciones nativas
  useEffect(() => {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);
  
  // Limpiar notificación
  const clearNotification = useCallback((notificationId: number) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);
  
  // Limpiar todas las notificaciones
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);
  
  return {
    notifications,
    status,
    connect,
    disconnect,
    clearNotification,
    clearAllNotifications
  };
}