import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

export function NotificationBadge() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/notifications/unread-count");
        return await response.json();
      } catch (error) {
        // Si hay un error, simplemente no mostramos el contador
        return { count: 0 };
      }
    },
    // Actualizamos el contador cada 30 segundos para tener notificaciones en tiempo real
    refetchInterval: 30000,
  });

  // Si no hay notificaciones sin leer o hay un error, no mostramos nada
  if (!data || data.count === 0) return null;

  return (
    <Badge className="bg-red-500 text-white absolute -top-1 -right-1 min-w-[1.25rem] h-5">
      {data.count > 99 ? "99+" : data.count}
    </Badge>
  );
}