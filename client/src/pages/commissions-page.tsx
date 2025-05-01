import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Topbar } from '@/components/layout/topbar';
import { useAuth } from '@/hooks/use-auth';
import { TabType } from '@/hooks/use-active-tab';
import { hasAccessToSection } from '@/lib/role-based-permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Componente principal para la página de comisiones
export default function CommissionsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("commissions");
  const [internalTab, setInternalTab] = useState('reservations');
  const [, setLocation] = useLocation();

  // Consulta para obtener todas las reservaciones creadas por comisionistas
  const { data: commissionReservations, isLoading } = useQuery({
    queryKey: ['/api/commissions/reservations'],
    queryFn: async () => {
      const response = await fetch('/api/commissions/reservations');
      if (!response.ok) {
        throw new Error('Error al obtener reservaciones de comisionistas');
      }
      return response.json();
    },
  });

  // Función para ir a la página de detalles de reservación
  const goToReservationDetails = (reservationId: number) => {
    setLocation(`/reservation-details?id=${reservationId}`);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: es });
  };

  // Maneja el cambio de pestaña en la navegación principal
  const handleTabChange = (tab: TabType) => {
    // En lugar de solo cambiar el estado local, redirigir a la URL correcta
    if (tab === "commissions") {
      // Si estamos ya en comisiones, no hacer nada
      return;
    }
    
    // Redirigir al dashboard con la pestaña seleccionada utilizando wouter
    setLocation(`/?tab=${tab}`);
  };

  // Verificar si el usuario tiene acceso a esta sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };

  // Componente para el contenido de comisiones
  const CommissionsContent = () => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Comisiones</h1>
        </div>

        <Card className="overflow-hidden">
          <Tabs value={internalTab} onValueChange={setInternalTab} className="w-full">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <TabsList className="bg-transparent border rounded-md">
                <TabsTrigger value="reservations">Reservaciones</TabsTrigger>
                <TabsTrigger value="reports">Reportes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="reservations" className="p-4">
              <div className="mb-4">
                <h2 className="text-lg font-medium">Reservaciones por Comisionistas</h2>
                <p className="text-sm text-gray-500">Listado de reservaciones creadas por comisionistas.</p>
                <Separator className="my-4" />
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Cargando reservaciones...</span>
                </div>
              ) : commissionReservations && commissionReservations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reservación</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisionista</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pasajeros</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {commissionReservations.map((reservation: any) => (
                        <tr
                          key={reservation.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => goToReservationDetails(reservation.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">#{reservation.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {reservation.createdByUser?.firstName} {reservation.createdByUser?.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{reservation.createdByUser?.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{reservation.trip.route.name}</div>
                            <div className="text-xs text-gray-500">{reservation.trip.route.origin} → {reservation.trip.route.destination}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDate(reservation.trip.departureDate)}</div>
                            <div className="text-xs text-gray-500">{reservation.trip.departureTime}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {reservation.passengers.length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">{formatPrice(reservation.totalAmount)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {reservation.createdByUser?.commissionPercentage ? (
                              <div className="text-sm font-medium text-primary">
                                {formatPrice(reservation.totalAmount * (reservation.createdByUser.commissionPercentage / 100))}
                                <span className="text-xs text-gray-500 ml-1">({reservation.createdByUser.commissionPercentage}%)</span>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">No configurada</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge 
                              variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                              className={reservation.paymentStatus === 'pagado' 
                                ? "bg-green-100 text-green-800 border-green-200" 
                                : "bg-amber-100 text-amber-800 border-amber-200"}
                            >
                              {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  No hay reservaciones de comisionistas disponibles.
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports" className="p-4">
              <div className="mb-4">
                <h2 className="text-lg font-medium">Reportes de Comisiones</h2>
                <p className="text-sm text-gray-500">Resumen de comisiones por agente.</p>
                <Separator className="my-4" />
              </div>

              <div className="text-center p-8 text-gray-500">
                La funcionalidad de reportes estará disponible próximamente.
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    );
  };

  // Si el usuario no tiene acceso, mostrar mensaje de acceso denegado
  if (!canAccess("commissions")) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
          <Topbar />
          
          <div className="flex-1 overflow-auto focus:outline-none">
            <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                  No tienes permisos para acceder a esta sección. Contacta al administrador si crees que deberías tener acceso.
                </AlertDescription>
              </Alert>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Layout para usuarios con acceso
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto">
            <CommissionsContent />
          </main>
        </div>
      </div>
    </div>
  );
}