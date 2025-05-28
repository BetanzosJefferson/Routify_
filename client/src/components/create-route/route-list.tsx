import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Route } from "@shared/schema";
import { MapIcon, PencilIcon, Trash2Icon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CreateRouteForm } from "./create-route-form";

export function RouteList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Datos de ejemplo para desarrollo
  const exampleRoutes: Route[] = [
    {
      id: 1,
      name: "Ruta de Ejemplo 1",
      origin: "Ciudad de México",
      destination: "Guadalajara",
      stops: ["Querétaro", "León"],
    },
    {
      id: 2,
      name: "Ruta de Ejemplo 2",
      origin: "Monterrey",
      destination: "Cancún",
      stops: ["Tampico", "Veracruz", "Villahermosa", "Campeche", "Mérida"],
    }
  ];

  // Fetch routes
  const routesQuery = useQuery<Route[]>({
    queryKey: ["/api/routes"],
    // Habilitamos la consulta real de rutas
    enabled: true,
    // Solo usar datos de ejemplo como respaldo si no hay rutas reales
    placeholderData: [],
    // Funciones personalizadas para la consulta
    queryFn: async () => {
      console.log("Cargando rutas...");
      const response = await fetch("/api/routes");
      if (!response.ok) {
        throw new Error("Error al cargar las rutas");
      }
      const data = await response.json();
      console.log("Rutas cargadas:", data);
      return data;
    },
    // Reintentamos la consulta automáticamente si falla
    retry: 3,
    retryDelay: 1000,
  });

  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("Eliminando ruta con ID:", id);
      try {
        const response = await fetch(`/api/routes/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Error al eliminar la ruta");
        }
        
        return true;
      } catch (error) {
        console.error("Error al eliminar ruta:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Ruta eliminada",
        description: "La ruta ha sido eliminada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar la ruta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle edit route
  const handleEditRoute = (route: Route) => {
    setSelectedRoute(route);
    setIsCreateDialogOpen(true);
  };

  // Handle delete route
  const handleDeleteRoute = (route: Route) => {
    setSelectedRoute(route);
    setIsDeleteDialogOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (selectedRoute) {
      deleteRouteMutation.mutate(selectedRoute.id);
    }
  };

  // Handle create new route
  const handleCreateNewRoute = () => {
    setSelectedRoute(null);
    setIsCreateDialogOpen(true);
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <Button 
          onClick={handleCreateNewRoute}
          className="bg-primary hover:bg-primary-dark text-white"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Crear Nueva Ruta
        </Button>
      </div>

      {routesQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : routesQuery.isError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudieron cargar las rutas. Por favor, inténtelo de nuevo.
          </AlertDescription>
        </Alert>
      ) : routesQuery.data?.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
          <CardContent className="py-10 text-center">
            <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No hay rutas creadas</h3>
            <p className="text-gray-500 mb-4">Crea tu primera ruta para comenzar a gestionar viajes.</p>
            <Button 
              onClick={handleCreateNewRoute}
              className="bg-primary hover:bg-primary-dark text-white"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Crear Nueva Ruta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routesQuery.data?.map((route) => (
            <Card key={route.id} className="border overflow-hidden">
              <CardHeader className="bg-gray-50 px-4 py-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-medium truncate">{route.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <span className="sr-only">Abrir menú</span>
                      <svg 
                        width="15" 
                        height="15" 
                        viewBox="0 0 15 15" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                      >
                        <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM12.5 8.625C13.1213 8.625 13.625 8.12132 13.625 7.5C13.625 6.87868 13.1213 6.375 12.5 6.375C11.8787 6.375 11.375 6.87868 11.375 7.5C11.375 8.12132 11.8787 8.625 12.5 8.625Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditRoute(route)}>
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteRoute(route)}
                      className="text-red-600"
                    >
                      <Trash2Icon className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Origen:</span>
                    <span className="font-medium text-gray-900">{route.origin}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Destino:</span>
                    <span className="font-medium text-gray-900">{route.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paradas:</span>
                    <span className="font-medium text-gray-900">{route.stops?.length || 0} paradas</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Route Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedRoute ? "Editar Ruta" : "Crear Nueva Ruta"}</DialogTitle>
            <DialogDescription>
              {selectedRoute 
                ? "Modifique los detalles de la ruta seleccionada." 
                : "Complete el formulario para crear una nueva ruta."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <CreateRouteForm 
              initialRoute={selectedRoute} 
              onSuccess={() => setIsCreateDialogOpen(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar la ruta "{selectedRoute?.name}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={deleteRouteMutation.isPending}
            >
              {deleteRouteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}