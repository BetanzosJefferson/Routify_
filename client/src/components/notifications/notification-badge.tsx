import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function NotificationBadge() {
  // Consultar el conteo de notificaciones no leídas
  const { data: unreadCount, isLoading, refetch } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });
  
  // Forzar una actualización cuando el componente se monte
  useEffect(() => {
    refetch();
  }, [refetch]);

  const count = unreadCount || 0;

  // No renderizar nada si no hay notificaciones no leídas
  if (count === 0) {
    return null;
  }

  return (
    <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
      <span className="text-xs font-bold text-white">
        {count > 9 ? '9+' : count}
      </span>
    </div>
  );
}