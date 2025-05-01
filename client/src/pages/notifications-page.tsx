import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CheckCircle } from "lucide-react";
import { TabType } from "@/hooks/use-active-tab";

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

export default function NotificationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Consulta para obtener notificaciones
  const { data: notifications, isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications");
      return await response.json();
    },
  });

  // Mutación para marcar como leída
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/notifications/${id}/mark-read`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error al marcar notificación",
        description: error.message || "Ha ocurrido un error. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  });

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    if (!notifications) return;
    
    const unreadNotifications = notifications.filter(notification => !notification.read);
    
    for (const notification of unreadNotifications) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    
    toast({
      title: "Notificaciones actualizadas",
      description: "Todas las notificaciones han sido marcadas como leídas.",
      variant: "default",
    });
  };

  // Función para el cambio de pestañas en el sidebar
  const [, setLocation] = useLocation();
  const [sidebarActiveTab, setSidebarActiveTab] = useState<TabType>("notifications");
  
  const handleTabChange = (tab: TabType) => {
    // Redirigir al dashboard con la pestaña seleccionada utilizando wouter
    setLocation(`/?tab=${tab}`);
  };

  // Componente de contenido de notificaciones
  function NotificationsContent() {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Centro de Notificaciones</h1>
          {notifications && notifications.some(n => !n.read) && (
            <Button 
              variant="outline" 
              onClick={markAllAsRead}
              disabled={markAsReadMutation.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center my-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">No tienes notificaciones.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationCard 
                key={notification.id} 
                notification={notification} 
                onMarkAsRead={() => markAsReadMutation.mutate(notification.id)} 
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Layout principal
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={sidebarActiveTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={sidebarActiveTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto">
            <NotificationsContent />
          </main>
        </div>
      </div>
    </div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: () => void;
}

function NotificationCard({ notification, onMarkAsRead }: NotificationCardProps) {
  // Formatear fechas
  const timeAgo = formatDistance(new Date(notification.createdAt), new Date(), {
    addSuffix: true,
    locale: es
  });
  
  // Determinar color y tipo de notificación
  const getNotificationStyles = () => {
    switch (notification.type) {
      case "info":
        return "bg-blue-50 border-blue-200";
      case "success":
        return "bg-green-50 border-green-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "error":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Card className={`${getNotificationStyles()} ${notification.read ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center">
              {notification.title}
              {!notification.read && (
                <Badge className="ml-3 bg-primary text-white" variant="outline">
                  Nueva
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{timeAgo}</CardDescription>
          </div>
          {!notification.read && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onMarkAsRead}
            >
              Marcar como leída
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{notification.message}</p>
      </CardContent>
    </Card>
  );
}