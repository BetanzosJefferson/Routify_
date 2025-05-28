import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess } from "@/lib/role-based-permissions";
import { UserRole } from "@shared/schema";
import DefaultLayout from "@/components/layout/default-layout";
import { TabType } from "@/hooks/use-active-tab";

// UI Components
import { PageTitle } from "@/components/ui/page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Package Components
import { PackageList } from "@/components/packages/package-list";
import { PackageForm } from "@/components/packages/package-form";
import { PackageTripSelection } from "@/components/packages/package-trip-selection";

export default function PackagesPage() {
  const { user } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "selectTrip" | "form">("list");
  const [activeTab] = useState<TabType>("packages");
  
  // Verificar permisos para acceder a esta página
  const hasAccess = user ? hasRoleAccess(user.role, [
    UserRole.OWNER, 
    UserRole.ADMIN, 
    UserRole.CALL_CENTER, 
    UserRole.CHECKER,
    UserRole.DRIVER,
    UserRole.TICKET_OFFICE
  ]) : false;
  
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
      <DefaultLayout activeTab={activeTab}>
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
      </DefaultLayout>
    );
  }
  
  return (
    <DefaultLayout activeTab={activeTab}>
      <div className="container mx-auto py-6">
        <PageTitle 
          title="Paqueterías" 
          description="Gestiona los envíos de paquetes" 
        />
        
        {view === "list" && (
          <PackageList 
            onAddPackage={handleAddPackage} 
            onEditPackage={handleEditPackage} 
          />
        )}
        
        {view === "selectTrip" && (
          <PackageTripSelection
            onTripSelect={handleTripSelect}
            onBack={() => setView("list")}
          />
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
              packageId={selectedPackageId || undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        )}
      </div>
    </DefaultLayout>
  );
}