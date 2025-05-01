import { useQuery } from "@tanstack/react-query";

export function NotificationBadge() {
  // Consultar el conteo de notificaciones no leídas
  const { data: unreadCount, isLoading } = useQuery<number>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 60000, // Refrescar cada minuto
  });
  
  const count = unreadCount || 0;

  if (isLoading || count === 0) {
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