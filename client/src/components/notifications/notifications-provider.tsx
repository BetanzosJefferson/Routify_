import { ReactNode } from "react";
import { useRealTimeNotifications } from "@/hooks/use-real-time-notifications";

interface NotificationsProviderProps {
  children: ReactNode;
}

// Este componente actúa como un wrapper que inicializa el sistema
// de notificaciones en tiempo real pero no renderiza ningún UI adicional
export function NotificationsProvider({ children }: NotificationsProviderProps) {
  // Inicializar el hook para escuchar notificaciones en tiempo real
  useRealTimeNotifications();
  
  // Simplemente renderizar los children sin afectar la estructura DOM
  return <>{children}</>;
}