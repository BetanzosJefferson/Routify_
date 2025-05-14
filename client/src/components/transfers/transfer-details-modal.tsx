import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle, XCircle, Circle, AlertCircle } from "lucide-react";
import { AddReservationModal } from "./add-reservation-modal";

interface TransferDetailsModalProps {
  transferId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const TransferDetailsModal = ({ transferId, isOpen, onClose }: TransferDetailsModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [isAddReservationModalOpen, setIsAddReservationModalOpen] = useState(false);

  const { data: transfer, isLoading, refetch } = useQuery({
    queryKey: [`/api/transfers/${transferId}`],
    queryFn: async () => {
      const response = await fetch(`/api/transfers/${transferId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles de la transferencia");
      }
      return response.json();
    },
    enabled: isOpen && !!transferId,
    refetchOnWindowFocus: false
  });

  const approveTransferMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/transfers/${transferId}/status`, {
        status: "aprobado"
      });
    },
    onSuccess: () => {
      toast({
        title: "Transferencia aprobada",
        description: "La transferencia ha sido aprobada con éxito",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo aprobar la transferencia",
        variant: "destructive",
      });
    }
  });

  const rejectTransferMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/transfers/${transferId}/status`, {
        status: "rechazado"
      });
    },
    onSuccess: () => {
      toast({
        title: "Transferencia rechazada",
        description: "La transferencia ha sido rechazada",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo rechazar la transferencia",
        variant: "destructive",
      });
    }
  });

  const handleApproveTransfer = () => {
    approveTransferMutation.mutate();
  };

  const handleRejectTransfer = () => {
    rejectTransferMutation.mutate();
  };

  const handleAddReservation = () => {
    setIsAddReservationModalOpen(true);
  };

  const handleReservationAdded = () => {
    setIsAddReservationModalOpen(false);
    refetch();
    toast({
      title: "Reservación añadida",
      description: "La reservación ha sido añadida a la transferencia",
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pendiente":
        return <Badge variant="outline">Pendiente</Badge>;
      case "aprobado":
        return <Badge variant="success">Aprobado</Badge>;
      case "rechazado":
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: es });
  };

  const canAddReservation = () => {
    if (!transfer) return false;
    
    // Solo la compañía de origen puede añadir reservaciones
    return (
      transfer.status === "pendiente" &&
      (user?.role === "superAdmin" || user?.companyId === transfer.sourceCompanyId)
    );
  };

  const canApproveOrReject = () => {
    if (!transfer) return false;
    
    // Solo la compañía destino puede aprobar/rechazar
    return (
      transfer.status === "pendiente" &&
      (user?.role === "superAdmin" || user?.companyId === transfer.targetCompanyId)
    );
  };

  const renderContent = () => {
    if (isLoading || !transfer) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    const { sourceTrip, targetTrip, routeMapping, reservations } = transfer;

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="compatibility">Compatibilidad</TabsTrigger>
          <TabsTrigger value="reservations">Reservaciones ({reservations?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Viaje de origen</h3>
              <div className="border rounded-md p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span>{sourceTrip.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ruta:</span>
                  <span>{sourceTrip.route.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origen:</span>
                  <span>{sourceTrip.route.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span>{sourceTrip.route.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{format(new Date(sourceTrip.departureDate), "dd MMM yyyy", { locale: es })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salida:</span>
                  <span>{sourceTrip.departureTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Llegada:</span>
                  <span>{sourceTrip.arrivalTime}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Viaje de destino</h3>
              <div className="border rounded-md p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span>{targetTrip.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ruta:</span>
                  <span>{targetTrip.route.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origen:</span>
                  <span>{targetTrip.route.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span>{targetTrip.route.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{format(new Date(targetTrip.departureDate), "dd MMM yyyy", { locale: es })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salida:</span>
                  <span>{targetTrip.departureTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Llegada:</span>
                  <span>{targetTrip.arrivalTime}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Información de la transferencia</h3>
            <div className="border rounded-md p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span>{transfer.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <span>{renderStatusBadge(transfer.status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha de solicitud:</span>
                <span>{formatDate(transfer.requestedAt)}</span>
              </div>
              {transfer.respondedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha de respuesta:</span>
                  <span>{formatDate(transfer.respondedAt)}</span>
                </div>
              )}
              {transfer.reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo:</span>
                  <span>{transfer.reason}</span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compatibility">
          {routeMapping ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <span className="mr-2">
                    {routeMapping.originMatches ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </span>
                  <span>
                    {routeMapping.originMatches
                      ? "El origen de ambas rutas coincide"
                      : "El origen de las rutas no coincide"}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2">
                    {routeMapping.destinationMatches ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </span>
                  <span>
                    {routeMapping.destinationMatches
                      ? "El destino de ambas rutas coincide"
                      : "El destino de las rutas no coincide"}
                  </span>
                </div>
              </div>

              {routeMapping.skippedStops.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                    Paradas omitidas en la ruta destino
                  </h4>
                  <ul className="list-disc list-inside pl-4">
                    {routeMapping.skippedStops.map((stop, index) => (
                      <li key={index}>{stop}</li>
                    ))}
                  </ul>
                </div>
              )}

              {routeMapping.additionalStops.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-2 flex items-center">
                    <Circle className="h-4 w-4 mr-2 text-blue-500" />
                    Paradas adicionales en la ruta destino
                  </h4>
                  <ul className="list-disc list-inside pl-4">
                    {routeMapping.additionalStops.map((stop, index) => (
                      <li key={index}>{stop}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Nota: Al momento de transferir las reservaciones, los puntos de origen y destino
                  pueden necesitar ajustes si las rutas no son idénticas.
                </p>
              </div>
            </div>
          ) : (
            <p>No hay información de compatibilidad disponible</p>
          )}
        </TabsContent>

        <TabsContent value="reservations">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Reservaciones a transferir</h3>
            
            {canAddReservation() && (
              <Button onClick={handleAddReservation}>
                Añadir reservación
              </Button>
            )}
          </div>
          
          {reservations && reservations.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Reservación</TableHead>
                    <TableHead>Origen Original</TableHead>
                    <TableHead>Destino Original</TableHead>
                    <TableHead>Nuevo Origen</TableHead>
                    <TableHead>Nuevo Destino</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((res: any) => (
                    <TableRow key={res.id}>
                      <TableCell>{res.reservationId}</TableCell>
                      <TableCell>{res.originalOrigin}</TableCell>
                      <TableCell>{res.originalDestination}</TableCell>
                      <TableCell>{res.newOrigin}</TableCell>
                      <TableCell>{res.newDestination}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">
                No hay reservaciones añadidas a esta transferencia
              </p>
              {canAddReservation() && (
                <Button onClick={handleAddReservation} className="mt-4">
                  Añadir reservación
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de transferencia</DialogTitle>
            <DialogDescription>
              Información detallada sobre la transferencia entre compañías
            </DialogDescription>
          </DialogHeader>

          {renderContent()}

          <DialogFooter className="mt-6">
            {canApproveOrReject() && (
              <div className="flex space-x-2 mr-auto">
                <Button
                  variant="default"
                  onClick={handleApproveTransfer}
                  disabled={approveTransferMutation.isPending}
                >
                  {approveTransferMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aprobar
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectTransfer}
                  disabled={rejectTransferMutation.isPending}
                >
                  {rejectTransferMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Rechazar
                    </>
                  )}
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {transfer && isAddReservationModalOpen && (
        <AddReservationModal
          transferId={transferId}
          sourceTripId={transfer.sourceTripId}
          isOpen={isAddReservationModalOpen}
          onClose={() => setIsAddReservationModalOpen(false)}
          onReservationAdded={handleReservationAdded}
        />
      )}
    </>
  );
};