import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";

import { Topbar } from "@/components/layout/topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle, CheckCircle, PercentIcon } from "lucide-react";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import { cn } from "@/lib/utils";
import { TabType } from "@/hooks/use-active-tab";

export default function MyCommissionsPage() {
  // Simular funcionalidad de useActiveTab sin usar el hook directamente
  const [activeTab, setActiveTab] = useState<TabType>("trips");
  const handleTabChange = (tab: TabType) => setActiveTab(tab);
  
  const { user } = useAuth();

  // Estado para las pestañas
  const [commissionTab, setCommissionTab] = useState("pendientes");

  // Función para determinar si el usuario tiene acceso a esta sección
  const canAccess = (section: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, section);
  };

  // Consulta para obtener las comisiones del comisionista actual
  const { data: myCommissions, isLoading, error } = useQuery({
    queryKey: ['/api/commissions/my-commissions'],
    queryFn: async () => {
      try {
        console.log('Consultando mis comisiones...');
        const response = await fetch('/api/commissions/my-commissions');
        console.log('Respuesta recibida:', response.status);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error obteniendo comisiones:', errorText);
          throw new Error(`Error al obtener comisiones: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        console.log('Datos de comisiones recibidos:', data);
        return data;
      } catch (err) {
        console.error('Error en la consulta de comisiones:', err);
        throw err;
      }
    },
    enabled: !!user, // Solo ejecutar si el usuario está autenticado
  });

  // Si el usuario no tiene acceso, mostrar mensaje de acceso denegado
  if (!canAccess("my-commissions")) {
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

  // Función para formatear moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Filtrar comisiones según el estado (pendientes o pagadas)
  const pendingCommissions = myCommissions?.filter((comm: any) => !comm.commissionPaid) || [];
  const paidCommissions = myCommissions?.filter((comm: any) => comm.commissionPaid) || [];

  // Contenido principal de la página
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Mis Comisiones</h1>
            </div>

            <Card>
              <Tabs value={commissionTab} onValueChange={setCommissionTab}>
                <CardHeader className="pb-0">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pendientes">
                      Pendientes ({isLoading ? "..." : pendingCommissions.length})
                    </TabsTrigger>
                    <TabsTrigger value="pagadas">
                      Pagadas ({isLoading ? "..." : paidCommissions.length})
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="pt-6">
                  {isLoading ? (
                    // Estado de carga
                    <div className="space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex flex-col space-y-2">
                          <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    // Mostrar error
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>
                        {error instanceof Error ? error.message : 'Error al cargar las comisiones'}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    // Contenido para pestaña pendientes
                    <TabsContent value="pendientes">
                      {pendingCommissions.length === 0 ? (
                        <EmptyState message="No tienes comisiones pendientes de pago" />
                      ) : (
                        <CommissionsList commissions={pendingCommissions} />
                      )}
                    </TabsContent>
                  )}

                  {/* Contenido para pestaña pagadas (solo se muestra si hay datos) */}
                  {!isLoading && !error && (
                    <TabsContent value="pagadas">
                      {paidCommissions.length === 0 ? (
                        <EmptyState message="No tienes comisiones pagadas" />
                      ) : (
                        <CommissionsList commissions={paidCommissions} />
                      )}
                    </TabsContent>
                  )}
                </CardContent>
              </Tabs>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

// Componente para mostrar un estado vacío
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <PercentIcon className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-500 mb-2">{message}</p>
    </div>
  );
}

// Componente para mostrar la lista de comisiones
function CommissionsList({ commissions }: { commissions: any[] }) {
  // Función para formatear moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  return (
    <div className="space-y-4">
      {commissions.map((commission) => (
        <div
          key={commission.id}
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
            <div className="font-medium">
              Pasajero: {commission.passengerName}
            </div>
            <Badge variant={commission.commissionPaid ? "default" : "outline"} className={cn("mt-2 sm:mt-0", commission.commissionPaid ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200")}>
              {commission.commissionPaid ? (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" /> Pagada
                </>
              ) : (
                <>
                  <AlertCircle className="mr-1 h-3 w-3" /> Pendiente
                </>
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <div className="text-gray-500">Ruta</div>
              <div>{commission.routeName}</div>
            </div>
            <div>
              <div className="text-gray-500">Fecha</div>
              <div>{new Date(commission.departureDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-gray-500">Valor de comisión</div>
              <div className="font-semibold text-primary">
                {formatCurrency(commission.commissionAmount)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}