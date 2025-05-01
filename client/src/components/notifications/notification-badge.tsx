import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function NotificationBadge() {
  // Consultar las notificaciones completas para obtener un conteo preciso
  const { data: notifications, isLoading: isLoadingNotifications, refetch: refetchNotifications } = useQuery<any[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 15000, // Refrescar cada 15 segundos
    staleTime: 5000, // Considerar los datos obsoletos después de 5 segundos
  });
  
  // Forzar una actualización cuando el componente se monte y cada 30 segundos
  useEffect(() => {
    // Refrescar inmediatamente al montar
    refetchNotifications();
    
    // Configurar intervalo de refresco
    const interval = setInterval(() => {
      refetchNotifications();
    }, 30000);
    
    // Limpiar al desmontar
    return () => clearInterval(interval);
  }, [refetchNotifications]);

  // Calcular el número real de notificaciones no leídas
  const unreadCount = Array.isArray(notifications) 
    ? notifications.filter(n => !n.read).length 
    : 0;
    
  console.log("Conteo de notificaciones no leídas:", unreadCount, "Total notificaciones:", notifications?.length || 0);

  // No mostrar nada si no hay notificaciones no leídas
  if (unreadCount === 0) {
    return null;
  }

  return (
    <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
      <span className="text-xs font-bold text-white">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </div>
  );
}