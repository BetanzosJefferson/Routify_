import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Package } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreVertical,
  Printer,
  Edit,
  Trash2,
  PackageCheck,
  Package as PackageIcon,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { PackageTicket } from "./package-ticket";
import { hasRoleAccess } from "@/lib/role-based-permissions";

interface PackageListProps {
  onAddPackage?: () => void;
  onEditPackage?: (packageId: number) => void;
  tripId?: number;
}

export function PackageList({ onAddPackage, onEditPackage, tripId }: PackageListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [packageToPrint, setPackageToPrint] = useState<Package | null>(null);
  const [packageToDelete, setPackageToDelete] = useState<number | null>(null);
  const [isThermalPrinting, setIsThermalPrinting] = useState(false);
  
  // Constantes para permisos
  const canWrite = user ? hasRoleAccess(user.role, ["dueño", "administrador", "callCenter"]) : false;
  
  // Query para obtener la lista de paquetes
  const packagesQuery = useQuery({
    queryKey: ["/api/packages", tripId],
    queryFn: async () => {
      const url = new URL("/api/packages", window.location.origin);
      if (tripId) {
        url.searchParams.append("tripId", String(tripId));
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Error al cargar paquetes");
      }
      return response.json() as Promise<Package[]>;
    },
  });
  
  // Mutación para actualizar el estado de entrega de un paquete
  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ packageId, status }: { packageId: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/packages/${packageId}`, {
        deliveryStatus: status,
      });
      if (!response.ok) {
        throw new Error("Error al actualizar el estado del paquete");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Estado actualizado",
        description: "El estado del paquete ha sido actualizado correctamente",
        variant: "success",
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
      const response = await apiRequest("DELETE", `/api/packages/${packageId}`);
      if (!response.ok) {
        throw new Error("Error al eliminar el paquete");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paquete eliminado",
        description: "El paquete ha sido eliminado correctamente",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      setPackageToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Función para generar recibo térmico
  const handlePrint = (packageData: Package) => {
    setPackageToPrint(packageData);
    setIsThermalPrinting(true);
    
    // Simular tiempo para preparar la impresión
    setTimeout(() => {
      window.print();
      setIsThermalPrinting(false);
    }, 1000);
  };
  
  // Función para marcar como entregado
  const handleMarkAsDelivered = (packageId: number) => {
    updateDeliveryStatusMutation.mutate({ packageId, status: "entregado" });
  };
  
  // Función para marcar como pendiente
  const handleMarkAsPending = (packageId: number) => {
    updateDeliveryStatusMutation.mutate({ packageId, status: "pendiente" });
  };
  
  // Función para eliminar paquete
  const handleDeletePackage = () => {
    if (packageToDelete) {
      deletePackageMutation.mutate(packageToDelete);
    }
  };
  
  // Mapeo de estados de entrega a colores de badge
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "entregado":
        return "default"; // verde
      case "pendiente":
        return "secondary"; // naranja
      default:
        return "outline";
    }
  };
  
  // Formatear nombre completo
  const formatFullName = (firstName: string, lastName: string) => {
    return `${firstName} ${lastName}`;
  };
  
  if (packagesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (packagesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            No se pudieron cargar los paquetes
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
          <Button 
            variant="outline" 
            onClick={() => packagesQuery.refetch()}
          >
            Reintentar
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Encabezado con botón de agregar */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          Paqueterías ({packagesQuery.data?.length || 0})
        </h2>
        {canWrite && (
          <Button onClick={onAddPackage} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Nuevo Paquete</span>
          </Button>
        )}
      </div>
      
      {/* Tabla principal */}
      {packagesQuery.data && packagesQuery.data.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableCaption>Lista de paquetes registrados</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Remitente</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado de Pago</TableHead>
                <TableHead>Estado de Entrega</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packagesQuery.data.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.id}</TableCell>
                  <TableCell>
                    {formatFullName(pkg.senderName, pkg.senderLastName)}
                    <div className="text-xs text-muted-foreground">{pkg.senderPhone}</div>
                  </TableCell>
                  <TableCell>
                    {formatFullName(pkg.recipientName, pkg.recipientLastName)}
                    <div className="text-xs text-muted-foreground">{pkg.recipientPhone}</div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={pkg.packageDescription}>
                    {pkg.packageDescription}
                  </TableCell>
                  <TableCell>{formatCurrency(pkg.price)}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.isPaid ? "default" : "secondary"}>
                      {pkg.isPaid ? "PAGADO" : "PENDIENTE"}
                    </Badge>
                    {pkg.isPaid && pkg.paymentMethod && (
                      <div className="text-xs text-muted-foreground capitalize">
                        {pkg.paymentMethod}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(pkg.deliveryStatus || "")}>
                      {pkg.deliveryStatus === "entregado" ? "ENTREGADO" : "PENDIENTE"}
                    </Badge>
                    {pkg.deliveryStatus === "entregado" && (
                      <div className="text-xs text-muted-foreground">
                        {pkg.deliveredAt ? 
                          format(new Date(pkg.deliveredAt), "dd/MM/yyyy HH:mm", { locale: es }) : 
                          ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        
                        <DropdownMenuItem onClick={() => handlePrint(pkg)}>
                          <Printer className="mr-2 h-4 w-4" />
                          <span>Imprimir recibo</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        {canWrite && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => onEditPackage && onEditPackage(pkg.id)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              onClick={() => setPackageToDelete(pkg.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                          </>
                        )}
                        
                        {pkg.deliveryStatus !== "entregado" ? (
                          <DropdownMenuItem 
                            onClick={() => handleMarkAsDelivered(pkg.id)}
                          >
                            <PackageCheck className="mr-2 h-4 w-4" />
                            <span>Marcar como entregado</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleMarkAsPending(pkg.id)}
                          >
                            <PackageIcon className="mr-2 h-4 w-4" />
                            <span>Marcar como pendiente</span>
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No hay paquetes registrados</CardTitle>
            <CardDescription>
              No se encontraron paquetes. Puede crear uno nuevo haciendo clic en el botón "Nuevo Paquete".
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <PackageIcon className="h-16 w-16 text-muted-foreground opacity-50" />
          </CardContent>
          {canWrite && (
            <CardFooter className="justify-center">
              <Button onClick={onAddPackage}>
                <Plus className="mr-2 h-4 w-4" />
                <span>Nuevo Paquete</span>
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
      
      {/* Modal de confirmación para eliminar */}
      <AlertDialog 
        open={packageToDelete !== null} 
        onOpenChange={(open) => !open && setPackageToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el paquete y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePackage}
              disabled={deletePackageMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePackageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar paquete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Contenedor oculto para la impresión térmica */}
      <div className="hidden print:block">
        {packageToPrint && <PackageTicket packageData={packageToPrint} />}
      </div>
      
      {/* Overlay de carga durante la impresión */}
      {isThermalPrinting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h3 className="text-lg font-medium">Preparando impresión...</h3>
            <p className="text-sm text-muted-foreground">
              La ventana de impresión se abrirá automáticamente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}