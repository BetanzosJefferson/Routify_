import { useEffect, useRef, useState } from 'react';
import { useAuth } from './use-auth';

type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  debug?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { 
    onMessage, 
    onOpen, 
    onClose, 
    onError,
    autoReconnect = true,
    reconnectInterval = 5000,
    debug = false
  } = options;
  
  const { user } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  
  const log = (message: string, ...args: any[]) => {
    // Logging disabled for production
  };
  
  // Función para conectar al WebSocket
  const connect = () => {
    if (!user) {
      log('No hay usuario autenticado, no se establece conexión');
      return;
    }
    
    if (socket.current && (socket.current.readyState === WebSocket.OPEN || socket.current.readyState === WebSocket.CONNECTING)) {
      log('Ya existe una conexión WebSocket activa');
      return;
    }
    
    try {
      setStatus('connecting');
      log('Estableciendo conexión WebSocket...');
      
      // Usar siempre WebSocket Secure (wss://) para mayor seguridad
      const protocol = 'wss:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      // Crear nueva conexión
      socket.current = new WebSocket(wsUrl);
      
      socket.current.onopen = () => {
        log('Conexión WebSocket establecida');
        setStatus('open');
        
        // Enviar autenticación
        if (socket.current && user) {
          log(`Enviando autenticación para usuario ID: ${user.id}`);
          socket.current.send(JSON.stringify({
            type: 'auth',
            userId: user.id
          }));
        }
        
        if (onOpen) {
          onOpen();
        }
      };
      
      socket.current.onmessage = (event) => {
        try {
          log('Mensaje WebSocket recibido (raw):', event.data);
          
          const data = JSON.parse(event.data);
          log('Mensaje WebSocket procesado:', data);
          
          // Process notification without logging
          
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          // Error handling without logging
        }
      };
      
      socket.current.onclose = () => {
        log('Conexión WebSocket cerrada');
        setStatus('closed');
        
        if (onClose) {
          onClose();
        }
        
        // Reconectar automáticamente si está habilitado
        if (autoReconnect && user) {
          log(`Intentando reconectar en ${reconnectInterval / 1000} segundos...`);
          if (reconnectTimeout.current) {
            window.clearTimeout(reconnectTimeout.current);
          }
          reconnectTimeout.current = window.setTimeout(connect, reconnectInterval);
        }
      };
      
      socket.current.onerror = (error) => {
        setStatus('error');
        
        if (onError) {
          onError(error);
        }
      };
      
    } catch (error) {
      setStatus('error');
    }
  };
  
  // Función para desconectar el WebSocket
  const disconnect = () => {
    if (socket.current) {
      log('Cerrando conexión WebSocket...');
      socket.current.close();
      socket.current = null;
    }
    
    if (reconnectTimeout.current) {
      window.clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  };
  
  // Función para enviar un mensaje a través del WebSocket
  const sendMessage = (data: any) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socket.current.send(message);
      log('Mensaje enviado:', data);
      return true;
    } else {
      log('No se puede enviar mensaje: WebSocket no está abierto');
      return false;
    }
  };
  
  // Conectar cuando el componente se monta y el usuario está autenticado
  useEffect(() => {
    if (user) {
      connect();
    }
    
    // Limpiar al desmontar
    return () => {
      disconnect();
    };
  }, [user?.id]); // Reconectar si cambia el ID del usuario
  
  return {
    status,
    sendMessage,
    connect,
    disconnect
  };
}