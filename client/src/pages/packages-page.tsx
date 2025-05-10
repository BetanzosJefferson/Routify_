import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess } from "@/lib/role-based-permissions";
import { UserRole } from "@shared/schema";

// UI Components
import { PageTitle } from "@/components/ui/page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Truck, ArrowLeft } from "lucide-react";

// Package Components
import { PackageList } from "@/components/packages/package-list";
import { PackageForm } from "@/components/packages/package-form";

// Interfaces para los viajes
interface Trip {
  id: number;
  routeId: number;
  departureDate: string;
  routeName?: string;
  routeOrigin?: string;
  routeDestination?: string;
  departureTime?: string;
  arrivalTime?: string;
  price: number;
  vehicleType: string;
  capacity: number;
  availableSeats: number;
}

export default function PackagesPage() {
  const { user } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "selectTrip" | "form">("list");
  
  // Verificar permisos para acceder a esta página
  const hasAccess = user ? hasRoleAccess(user.role, [
    UserRole.OWNER, 
    UserRole.ADMIN, 
    UserRole.CALL_CENTER, 
    UserRole.CHECKER,
    UserRole.DRIVER
  ]) : false;
  
  // Consulta de viajes disponibles (usada para selección al crear paquete)
  const tripsQuery = useQuery({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const response = await fetch("/api/trips");
      if (!response.ok) {
        throw new Error("Error al cargar viajes");
      }
      return response.json();
    },
    enabled: view === "selectTrip", // Solo se ejecuta cuando necesitamos seleccionar un viaje
  });
  
  // Manejar click en viaje para seleccionarlo
  const handleTripSelect = (tripId: number) => {
    setSelectedTripId(tripId);
    setView("form");
  };
  
  // Manejar click en boton de agregar paquete
  const handleAddPackage = () => {
    setSelectedPackageId(null);
    setSelectedTripId(null);
    setView("selectTrip");
  };
  
  // Manejar click en botón de editar paquete
  const handleEditPackage = (packageId: number) => {
    setSelectedPackageId(packageId);
    setView("form");
  };
  
  // Manejar finalización de formulario
  const handleFormSuccess = () => {
    setView("list");
    setSelectedTripId(null);
    setSelectedPackageId(null);
  };
  
  // Manejar cancelación de formulario
  const handleFormCancel = () => {
    setView("list");
    setSelectedTripId(null);
    setSelectedPackageId(null);
  };
  
  // Si el usuario no tiene permiso
  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso Denegado</CardTitle>
          <CardDescription>
            No tienes permiso para acceder a la sección de paqueterías.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Por favor, contacta con el administrador del sistema si necesitas acceso a esta sección.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <PageTitle 
        title="Paqueterías" 
        description="Gestiona los envíos de paquetes" 
        icon={<Package />}
      />
      
      {view === "list" && (
        <PackageList 
          onAddPackage={handleAddPackage} 
          onEditPackage={handleEditPackage} 
        />
      )}
      
      {view === "selectTrip" && (
        <div className="space-y-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              className="mr-2" 
              onClick={() => setView("list")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h2 className="text-xl font-bold">Selecciona un viaje</h2>
          </div>
          
          {tripsQuery.isLoading ? (
            <div className="py-10 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              <p className="mt-2">Cargando viajes...</p>
            </div>
          ) : tripsQuery.isError ? (
            <Card>
              <CardHeader>
                <CardTitle>Error</CardTitle>
                <CardDescription>
                  No se pudieron cargar los viajes disponibles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-destructive">
                  {tripsQuery.error instanceof Error 
                    ? tripsQuery.error.message 
                    : "Error desconocido"}
                </p>
                <Button onClick={() => tripsQuery.refetch()} className="mt-4">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : tripsQuery.data && tripsQuery.data.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No hay viajes disponibles</CardTitle>
                <CardDescription>
                  Debes crear y publicar viajes antes de registrar paquetes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Los paquetes deben estar asociados a un viaje existente para su transporte.
                </p>
                <Button onClick={() => setView("list")}>
                  Volver a Paquetes
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tripsQuery.data.map((trip: Trip) => (
                <Card 
                  key={trip.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleTripSelect(trip.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{trip.routeName || "Viaje sin nombre"}</CardTitle>
                    <CardDescription className="text-xs">
                      {new Date(trip.departureDate).toLocaleDateString('es-MX')} • {trip.departureTime || 'Sin hora'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm flex flex-col space-y-1 text-muted-foreground">
                      <div className="flex items-center">
                        <span className="font-medium">Origen:</span> 
                        <span className="ml-2">{trip.routeOrigin || trip.routeName?.split(' a ')[0]}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium">Destino:</span> 
                        <span className="ml-2">{trip.routeDestination || trip.routeName?.split(' a ')[1]}</span>
                      </div>
                      <div className="flex items-center">
                        <Truck className="w-4 h-4 mr-1" />
                        <span>{trip.vehicleType}</span>
                        <span className="mx-2">•</span>
                        <span>{trip.availableSeats} asientos disponibles</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      
      {view === "form" && (
        <div className="space-y-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              className="mr-2" 
              onClick={() => setView("list")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h2 className="text-xl font-bold">
              {selectedPackageId ? "Editar Paquete" : "Registrar Nuevo Paquete"}
            </h2>
          </div>
          
          <PackageForm 
            tripId={selectedTripId || undefined} 
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}
    </div>
  );
}