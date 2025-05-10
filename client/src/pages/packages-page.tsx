import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PageTitle } from "@/components/ui/page-title";
import { PackageList } from "@/components/packages/package-list";
import { PackageForm } from "@/components/packages/package-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Posibles estados de la página
type PackagesPageState = "list" | "create" | "edit";

export default function PackagesPage() {
  // Estado para controlar la vista actual
  const [pageState, setPageState] = useState<PackagesPageState>("list");
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  
  // Si no está autenticado, redirigir al login
  if (!isLoading && !user) {
    setLocation("/auth");
    return null;
  }
  
  // Manejadores de eventos
  const handleAddPackage = () => {
    setPageState("create");
  };
  
  const handleEditPackage = (packageId: number) => {
    setSelectedPackageId(packageId);
    setPageState("edit");
  };
  
  const handleBackToList = () => {
    setPageState("list");
    setSelectedPackageId(null);
  };
  
  // Renderizado condicional basado en el estado de la página
  const renderContent = () => {
    switch (pageState) {
      case "create":
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
              <PageTitle title="Crear Nuevo Paquete" />
            </div>
            <PackageForm 
              onSuccess={handleBackToList}
              onCancel={handleBackToList}
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