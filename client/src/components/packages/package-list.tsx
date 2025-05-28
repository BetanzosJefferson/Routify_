import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess } from "@/lib/role-based-permissions";
import { UserRole } from "@shared/schema";

// UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  Package,
  MoreVertical,
  Edit,
  Printer,
  Trash,
  Check,
  Clock,
  Ban,
  Loader2,
  Plus,
  Share2,
  Search,
  Filter,
  X,
} from "lucide-react";

// Importar componentes relacionados con paquetes
import { PackageTicket } from "./package-ticket";
import { PackageDetailsModal } from "./package-details-modal";

interface PackageListProps {
  onAddPackage: () => void;
  onEditPackage: (packageId: number) => void;
}

export function PackageList({ onAddPackage, onEditPackage }: PackageListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [packageToDelete, setPackageToDelete] = useState<number | null>(null);
  const [packageToView, setPackageToView] = useState<any | null>(null);
  const [packageToDetail, setPackageToDetail] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  
  // Estados para filtros
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    date: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Determinar si el usuario puede añadir/editar paquetes
  const canCreateEdit = user ? hasRoleAccess(user.role, [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.CHECKER]) : false;
  
  // Determinar si el usuario puede eliminar paquetes
  const canDelete = user ? hasRoleAccess(user.role, [UserRole.OWNER, UserRole.ADMIN]) : false;
  
  // Obtener los paquetes
  const packagesQuery = useQuery({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const response = await fetch("/api/packages");
      if (!response.ok) {
        throw new Error("Error al cargar paquetes");
      }
      return response.json();
    },
  });

  // Filtrar paquetes basado en los filtros aplicados
  const filteredPackages = useMemo(() => {
    if (!packagesQuery.data) return [];
    
    return packagesQuery.data.filter((pkg: any) => {
      // Filtro por origen
      if (filters.origin && !pkg.tripOrigin?.toLowerCase().includes(filters.origin.toLowerCase())) {
        return false;
      }
      
      // Filtro por destino
      if (filters.destination && !pkg.tripDestination?.toLowerCase().includes(filters.destination.toLowerCase())) {
        return false;
      }
      
      // Filtro por fecha
      if (filters.date) {
        const packageDate = new Date(pkg.createdAt).toISOString().split('T')[0];
        if (packageDate !== filters.date) {
          return false;
        }
      }
      
      return true;
    });
  }, [packagesQuery.data, filters]);

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      origin: "",
      destination: "",
      date: "",
    });
  };

  // Contar filtros activos
  const activeFiltersCount = Object.values(filters).filter(value => value !== "").length;
  
  // Mutación para marcar un paquete como entregado
  const markAsDeliveredMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const response = await apiRequest("PATCH", `/api/packages/${packageId}/deliver`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al marcar como entregado");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paquete actualizado",
        description: "El paquete ha sido marcado como entregado",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para eliminar un paquete
  const deletePackageMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const response = await apiRequest("DELETE", `/api/packages/${packageId}`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar el paquete");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paquete eliminado",
        description: "El paquete ha sido eliminado exitosamente",
        variant: "default",
      });
      
      // Invalidar la caché de paquetes
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      
      // Invalidar también la caché de viajes para actualizar los asientos disponibles
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      setPackageToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setPackageToDelete(null);
    },
  });
  
  // Manejar la impresión del ticket usando jsPDF para el formato térmico
  const handlePrintTicket = () => {
    if (packageToView) {
      // Importar la función de generación de PDF de manera dinámica
      import('./package-ticket').then(({ generatePackageTicketPDF }) => {
        // Generar el PDF con dimensiones de ticket térmico (58mm x 160mm)
        generatePackageTicketPDF(packageToView, user?.company || "TransRoute");
        
        // Cerrar el diálogo automáticamente después de abrir la ventana del PDF
        setTimeout(() => {
          setPackageToView(null);
        }, 500);
      }).catch(error => {
        console.error("Error al generar el ticket PDF:", error);
        toast({
          title: "Error",
          description: "No se pudo generar el ticket PDF. Intente nuevamente.",
          variant: "destructive",
        });
      });
    }
  };
  
  // Renderizar el estado de carga
  if (packagesQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Renderizar el estado de error
  if (packagesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            No se pudieron cargar los paquetes. Por favor, intente de nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            {packagesQuery.error instanceof Error
              ? packagesQuery.error.message
              : "Error desconocido"}
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => packagesQuery.refetch()}>Reintentar</Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Renderizar cuando no hay paquetes
  if (!packagesQuery.data || packagesQuery.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No hay paquetes registrados</CardTitle>
          <CardDescription>
            Aún no hay paquetes registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Package className="h-16 w-16 text-muted-foreground opacity-50" />
        </CardContent>
        <CardFooter className="flex justify-center">
          {canCreateEdit && (
            <Button onClick={onAddPackage}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar nuevo paquete
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }
  
  // Renderizar la lista de paquetes
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">
            Paquetes ({filteredPackages.length})
          </h2>
          {activeFiltersCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} aplicado{activeFiltersCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
          {canCreateEdit && (
            <Button onClick={onAddPackage}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Paquete
            </Button>
          )}
        </div>
      </div>

      {/* Sección de filtros */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center">
                <Search className="mr-2 h-5 w-5" />
                Filtros de búsqueda
              </div>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpiar filtros
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-origin">Origen</Label>
                <Input
                  id="filter-origin"
                  placeholder="Buscar por origen..."
                  value={filters.origin}
                  onChange={(e) => setFilters(prev => ({ ...prev, origin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-destination">Destino</Label>
                <Input
                  id="filter-destination"
                  placeholder="Buscar por destino..."
                  value={filters.destination}
                  onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-date">Fecha</Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Remitente</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Asientos</TableHead>
              <TableHead>Estado Pago</TableHead>
              <TableHead>Estado Entrega</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPackages.map((pkg: any) => (
              <TableRow 
                key={pkg.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setPackageToDetail(pkg);
                  setIsDetailModalOpen(true);
                }}
              >
                <TableCell className="font-medium">{pkg.id}</TableCell>
                <TableCell>
                  {pkg.senderName} {pkg.senderLastName}
                  <div className="text-xs text-muted-foreground">
                    {pkg.senderPhone}
                  </div>
                </TableCell>
                <TableCell>
                  {pkg.recipientName} {pkg.recipientLastName}
                  <div className="text-xs text-muted-foreground">
                    {pkg.recipientPhone}
                  </div>
                </TableCell>
                <TableCell>
                  {pkg.segmentOrigin || pkg.tripOrigin || "No disponible"}
                </TableCell>
                <TableCell>
                  {pkg.segmentDestination || pkg.tripDestination || "No disponible"}
                </TableCell>
                <TableCell>{formatCurrency(pkg.price)}</TableCell>
                <TableCell>
                  {pkg.usesSeats ? (
                    <Badge className="bg-orange-500 hover:bg-orange-600">
                      {pkg.seatsQuantity} {pkg.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No usa</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {pkg.isPaid ? (
                    <Badge className="bg-green-500 hover:bg-green-600">
                      <Check className="mr-1 h-3 w-3" /> Pagado
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="mr-1 h-3 w-3" /> Pendiente
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {pkg.deliveryStatus === "entregado" ? (
                    <Badge className="bg-green-500 hover:bg-green-600">
                      <Check className="mr-1 h-3 w-3" /> Entregado
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="mr-1 h-3 w-3" /> Pendiente
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{pkg.tripDate ? formatDate(new Date(pkg.tripDate)) : formatDate(new Date(pkg.createdAt))}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canCreateEdit && (
                        <DropdownMenuItem onClick={() => onEditPackage(pkg.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuItem asChild>
                        <Link href={`/package/${pkg.id}`} target="_blank">
                          <Share2 className="mr-2 h-4 w-4" />
                          Ver ficha pública
                        </Link>
                      </DropdownMenuItem>

                      <Dialog>
                        <DialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setPackageToView(pkg);
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Ver/Imprimir Ticket
                          </DropdownMenuItem>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Ticket de Paquete</DialogTitle>
                          </DialogHeader>
                          {packageToView && (
                            <div className="flex flex-col items-center">
                              <PackageTicket 
                                packageData={packageToView} 
                                companyName={user?.company || "TransRoute"} 
                              />
                              <Button 
                                onClick={handlePrintTicket} 
                                className="mt-4"
                              >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Ticket
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      {canCreateEdit && pkg.deliveryStatus !== "entregado" && (
                        <DropdownMenuItem
                          onClick={() => {
                            markAsDeliveredMutation.mutate(pkg.id);
                          }}
                          disabled={markAsDeliveredMutation.isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Marcar como Entregado
                        </DropdownMenuItem>
                      )}
                      
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setPackageToDelete(pkg.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Diálogo de confirmación para eliminar paquete */}
      <AlertDialog open={!!packageToDelete} onOpenChange={(open) => !open && setPackageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el paquete del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => packageToDelete && deletePackageMutation.mutate(packageToDelete)}
              disabled={deletePackageMutation.isPending}
            >
              {deletePackageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Modal de detalles de paquete */}
      <PackageDetailsModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        packageData={packageToDetail}
      />
    </div>
  );
}