import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import TransferDetailsModal from "@/components/notifications/transfer-details-modal";
import { CheckCircle, BellIcon, BellOff, ExternalLink } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Interfaz para el tipo de notificación
interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  userId: number;
  relatedId: number | null;
  metaData?: string; // Datos adicionales en formato JSON
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Consulta para obtener notificaciones
  const { data: notifications, isLoading, refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications");
      return await response.json();
    },
    // Siempre mantener las notificaciones actualizadas
    staleTime: 15000, // 15 segundos
    refetchInterval: 20000, // Refrescar cada 20 segundos
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
  const markAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!notifications) return;
    
    const unreadNotifications = notifications.filter(notification => !notification.read);
    
    if (unreadNotifications.length === 0) return;
    
    try {
      // Marcar todas las notificaciones como leídas
      for (const notification of unreadNotifications) {
        await markAsReadMutation.mutateAsync(notification.id);
      }
      
      // Forzar una actualización inmediata
      refetchNotifications();
      
      toast({
        title: "Notificaciones actualizadas",
        description: "Todas las notificaciones han sido marcadas como leídas.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Hubo un problema al marcar las notificaciones como leídas.",
        variant: "destructive",
      });
    }
  };

  // Ver todas las notificaciones
  const viewAllNotifications = () => {
    setOpen(false);
    setLocation('/notifications');
  };

  // Determinar si hay notificaciones no leídas
  const hasUnread = notifications?.some(n => !n.read) || false;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-gray-500 relative"
        >
          <BellIcon className="h-5 w-5" />
          <NotificationBadge />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80" 
        align="end" 
        forceMount
      >
        <DropdownMenuLabel className="font-normal flex items-center justify-between">
          <div className="text-sm font-semibold">Notificaciones</div>
          {hasUnread && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-7 text-xs"
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Marcar todas como leídas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <BellOff className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm">No tienes notificaciones.</p>
            </div>
          ) : (
            <DropdownMenuGroup>
              {notifications.slice(0, 5).map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                  onMarkAsRead={() => {
                    markAsReadMutation.mutate(notification.id, {
                      onSuccess: () => {
                        refetchNotifications();
                      }
                    });
                  }}
                  onShowTransferDetails={(notification) => {
                    setSelectedNotification(notification);
                    setTransferModalOpen(true);
                    setOpen(false); // Cerrar el dropdown al abrir el modal
                  }} 
                />
              ))}
            </DropdownMenuGroup>
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={viewAllNotifications} className="cursor-pointer justify-center">
          <ExternalLink className="mr-2 h-4 w-4" />
          <span>Ver todas las notificaciones</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      
      {/* Modal de detalles de transferencia */}
      <TransferDetailsModal 
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        notification={selectedNotification}
      />
    </DropdownMenu>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onShowTransferDetails?: (notification: Notification) => void;
}

function NotificationItem({ notification, onMarkAsRead, onShowTransferDetails }: NotificationItemProps) {
  const [, setLocation] = useLocation();
  
  // Formatear tiempo
  const timeAgo = formatDistance(new Date(notification.createdAt), new Date(), {
    addSuffix: true,
    locale: es
  });
  
  // Determinar avatar según tipo de notificación
  const getAvatar = () => {
    const avatarColors = {
      info: { bg: "bg-blue-100", text: "text-blue-600" },
      success: { bg: "bg-green-100", text: "text-green-600" },
      warning: { bg: "bg-yellow-100", text: "text-yellow-600" },
      error: { bg: "bg-red-100", text: "text-red-600" },
      reservation_approved: { bg: "bg-green-100", text: "text-green-600" },
      reservation_rejected: { bg: "bg-red-100", text: "text-red-600" },
      reservation_request: { bg: "bg-blue-100", text: "text-blue-600" },
      transfer: { bg: "bg-purple-100", text: "text-purple-600" }, // Agregar tipo de transferencia
    };
    
    // Determinar colores basados en el tipo
    const colors = avatarColors[notification.type as keyof typeof avatarColors] || 
      { bg: "bg-gray-100", text: "text-gray-600" };
    
    return (
      <Avatar className="h-8 w-8">
        <AvatarFallback className={`${colors.bg} ${colors.text}`}>
          {notification.title.charAt(0)}
        </AvatarFallback>
      </Avatar>
    );
  };
  
  // Manejar el clic en la notificación
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Si es una notificación de transferencia, mostrar detalles en lugar de navegar
    if (notification.type === 'transfer') {
      if (onShowTransferDetails) {
        onShowTransferDetails(notification);
      } else {
        setLocation(`/notifications?transferId=${notification.id}`);
      }
    }
    
    // Si es una notificación de solicitud de reservación, navegar a la solicitud específica
    if (notification.type === 'reservation_request' && notification.relatedId) {
      setLocation(`/reservation-requests?requestId=${notification.relatedId}`);
    }
    
    // Si no está leída, marcarla como leída
    if (!notification.read) {
      onMarkAsRead();
    }
  };
  
  return (
    <DropdownMenuItem 
      className={`flex items-start gap-3 px-4 py-3 ${(notification.type === 'transfer' || notification.type === 'reservation_request') ? 'cursor-pointer' : 'cursor-default'} ${notification.read ? 'opacity-70' : 'bg-primary/5'}`}
      onSelect={(e) => e.preventDefault()}
      onClick={(notification.type === 'transfer' || notification.type === 'reservation_request') ? handleClick : undefined}
    >
      {getAvatar()}
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {notification.title}
            {!notification.read && (
              <Badge variant="outline" className="ml-2 bg-primary text-white text-[10px] py-0 h-4">
                Nueva
              </Badge>
            )}
          </p>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
        <div className="flex justify-between items-center">
          {!notification.read && (
            <Button 
              variant="link" 
              size="sm" 
              className="h-auto p-0 text-xs text-primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkAsRead();
              }}
            >
              Marcar como leída
            </Button>
          )}
          
          {notification.type === 'transfer' && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-purple-600 ml-auto"
              onClick={handleClick}
            >
              Ver detalles
            </Button>
          )}
        </div>
      </div>
    </DropdownMenuItem>
  );
}