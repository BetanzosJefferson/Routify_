import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { PageTitle } from "@/components/ui/page-title";
import { PackageList } from "@/components/packages/package-list";
import { PackageForm } from "@/components/packages/package-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Package, Calendar, MapPin, Bus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TripWithRouteInfo } from "@shared/schema";

// Posibles estados de la página
type PackagesPageState = "list" | "select-trip" | "create" | "edit";

export default function PackagesPage() {
  // Estado para controlar la vista actual
  const [pageState, setPageState] = useState<PackagesPageState>("list");
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  
  // Si no está autenticado, redirigir al login
  if (!isLoading && !user) {
    setLocation("/auth");
    return null;
  }
  
  // Consulta para obtener los viajes disponibles
  const tripsQuery = useQuery({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const response = await fetch("/api/trips");
      if (!response.ok) {
        throw new Error("Error al cargar viajes");
      }
      return response.json() as Promise<TripWithRouteInfo[]>;
    },
    enabled: pageState === "select-trip",
  });
  
  // Manejadores de eventos
  const handleAddPackage = () => {
    setPageState("select-trip");
  };
  
  const handleEditPackage = (packageId: number) => {
    setSelectedPackageId(packageId);
    setPageState("edit");
  };
  
  const handleBackToList = () => {
    setPageState("list");
    setSelectedPackageId(null);
    setSelectedTripId(null);
  };
  
  const handleSelectTrip = (tripId: number) => {
    setSelectedTripId(tripId);
    setPageState("create");
  };
  
  const handleBackToTripSelection = () => {
    setPageState("select-trip");
    setSelectedPackageId(null);
  };
  
  // Renderizado condicional basado en el estado de la página
  const renderContent = () => {
    switch (pageState) {
      case "select-trip":
        return (
          <div className="space-y-4">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <PageTitle title="Seleccionar Viaje para el Paquete" />
            </div>
            
            {tripsQuery.isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tripsQuery.isError ? (
              <Card>
                <CardHeader>
                  <CardTitle>Error</CardTitle>
                  <CardDescription>No se pudieron cargar los viajes disponibles</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-destructive">
                    {tripsQuery.error instanceof Error
                      ? tripsQuery.error.message
                      : "Error desconocido"}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => tripsQuery.refetch()}
                  >
                    Reintentar
                  </Button>
                </CardFooter>
              </Card>
            ) : tripsQuery.data && tripsQuery.data.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tripsQuery.data.map((trip) => (
                  <Card 
                    key={trip.id} 
                    className="cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => handleSelectTrip(trip.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{trip.route.name}</CardTitle>
                      <CardDescription>
                        {formatDate(trip.departureDate)} - {trip.departureTime}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {trip.route.origin} - {trip.route.destination}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatDate(trip.departureDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bus className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {trip.vehicleType || "No especificado"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full">
                        <Package className="mr-2 h-4 w-4" />
                        Seleccionar este viaje
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No hay viajes disponibles</CardTitle>
                  <CardDescription>
                    No se encontraron viajes programados para transportar paquetes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-6">
                  <Bus className="h-16 w-16 text-muted-foreground opacity-50" />
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button variant="outline" onClick={handleBackToList}>
                    Volver a la lista de paquetes
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        );
        
      case "create":
        return (
          <div className="space-y-4">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                onClick={handleBackToTripSelection}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a selección de viaje
              </Button>
              <PageTitle title="Crear Nuevo Paquete" />
            </div>
            <PackageForm 
              tripId={selectedTripId || undefined}
              onSuccess={handleBackToList}
              onCancel={handleBackToTripSelection}
            />
          </div>
        );
        
      case "edit":
        return (
          <div className="space-y-4">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <PageTitle title="Editar Paquete" />
            </div>
            {/* Aquí se implementaría un componente de edición similar al de creación */}
            <p className="text-muted-foreground">
              La funcionalidad de edición se implementará próximamente
            </p>
            <Button onClick={handleBackToList}>Volver a la lista</Button>
          </div>
        );
        
      case "list":
      default:
        return (
          <div className="space-y-6">
            <PageTitle 
              title="Gestión de Paqueterías"
              description="Administre el envío y seguimiento de paquetes"
            />
            
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">Todos los paquetes</TabsTrigger>
                <TabsTrigger value="pending">Pendientes</TabsTrigger>
                <TabsTrigger value="delivered">Entregados</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-6">
                <PackageList 
                  onAddPackage={handleAddPackage}
                  onEditPackage={handleEditPackage}
                />
              </TabsContent>
              
              <TabsContent value="pending" className="mt-6">
                <p className="text-muted-foreground mb-4">
                  Esta vista mostrará solo los paquetes en estado pendiente.
                </p>
                <PackageList 
                  onAddPackage={handleAddPackage}
                  onEditPackage={handleEditPackage}
                />
              </TabsContent>
              
              <TabsContent value="delivered" className="mt-6">
                <p className="text-muted-foreground mb-4">
                  Esta vista mostrará solo los paquetes entregados.
                </p>
                <PackageList 
                  onAddPackage={handleAddPackage}
                  onEditPackage={handleEditPackage}
                />
              </TabsContent>
            </Tabs>
          </div>
        );
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      {renderContent()}
      
      {/* Estilos CSS para impresión de tickets térmicos */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          
          @page {
            size: 58mm 210mm; /* Tamaño típico de papel térmico */
            margin: 0;
          }
          
          * {
            box-sizing: border-box;
          }
          
          /* Ocultar todo excepto el ticket */
          body > :not(.print-container) {
            display: none !important;
          }
          
          .print-container {
            display: block !important;
            width: 100%;
            padding: 0;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}