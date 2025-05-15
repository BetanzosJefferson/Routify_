import { useEffect, useRef } from 'react';

// Importar el archivo de sonido
import notificationSound from '@assets/notificacion.mp3';

export function useNotificationSound() {
  // Referencia al elemento de audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Inicializar el elemento de audio
  useEffect(() => {
    // Crear el elemento de audio
    audioRef.current = new Audio(notificationSound);
    
    // Configurar el volumen
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
    }
    
    // Limpiar al desmontar
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Función para reproducir el sonido
  const playNotificationSound = () => {
    console.log('[Audio] Intentando reproducir sonido de notificación');
    
    try {
      // Intentar crear un nuevo elemento de audio cada vez
      // Esto ayuda a evitar problemas con navegadores que no permiten reproducir
      // el mismo elemento de audio múltiples veces
      const tempAudio = new Audio(notificationSound);
      tempAudio.volume = 0.6; // Aumentar volumen ligeramente
      
      // Añadir evento para detectar si la reproducción inicia correctamente
      tempAudio.onplay = () => {
        console.log('[Audio] Reproducción de sonido iniciada correctamente');
      };
      
      // Añadir evento para detectar cuando finaliza la reproducción
      tempAudio.onended = () => {
        console.log('[Audio] Reproducción de sonido finalizada');
      };
      
      // Reproducir el sonido
      const playPromise = tempAudio.play();
      
      // Manejar posibles errores
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[Audio] Promesa de reproducción resuelta exitosamente');
          })
          .catch((error) => {
            console.error('[Audio] Error al reproducir sonido:', error);
            
            // Intentar reproducir con el audio de referencia como fallback
            if (audioRef.current) {
              console.log('[Audio] Intentando reproducir con el audio de referencia...');
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(err => {
                console.error('[Audio] Error en segundo intento de reproducción:', err);
              });
            }
          });
      }
    } catch (error) {
      console.error('[Audio] Error al crear/inicializar audio:', error);
    }
  };
  
  return { playNotificationSound };
}