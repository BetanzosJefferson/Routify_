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
    if (audioRef.current) {
      // Reiniciar el audio en caso de que ya esté reproduciéndose
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Reproducir el sonido
      const playPromise = audioRef.current.play();
      
      // Manejar posibles errores (algunos navegadores bloquean la reproducción automática)
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('Error al reproducir sonido de notificación:', error);
        });
      }
    }
  };
  
  return { playNotificationSound };
}