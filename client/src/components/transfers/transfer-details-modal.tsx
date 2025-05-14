import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, X, AlertCircle, UserPlus } from "lucide-react";
import { AddReservationModal } from "./add-reservation-modal";

// Definir interfaces para los tipos de datos
interface Transfer {
  id: number;
  sourceCompanyId: string | null;
  targetCompanyId: string | null;
  tripId: number;
  status: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
  sourceCompanyName: string;
  targetCompanyName: string;
  tripDetails: {
    departureDate: Date;
    departureTime: string;
    origin: string;
    destination: string;
    route: {
      name: string;
      stops: string[];
    };
  };
  reservationCount: number;
  reservations?: Reservation[];
}

interface Reservation {
  id: number;
  passengerName: string;
  passengerLastName: string;
  seatNumber: number;
  status: string;
  transferStatus?: string;
}

interface TransferDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: Transfer;
  onTransferUpdated: () => void;
}

const TransferDetailsModal = ({ 
  isOpen, 
  onClose, 
  transfer, 
  onTransferUpdated 
}: TransferDetailsModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");
  const [isAddReservationOpen, setIsAddReservationOpen] = useState(false);
  
  const isSource = user?.companyId === transfer.sourceCompanyId;
  const isTarget = user?.companyId === transfer.targetCompanyId;
  const canApprove = isTarget && transfer.status === "pending";
  const canAddReservations = isSource && (transfer.status === "approved" || transfer.status === "pending");
  
  // Mutación para aprobar una transferencia
  const approveTransferMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/transfers/${transfer.id}/approve`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia aprobada",
        description: "La transferencia ha sido aprobada correctamente",
        variant: "success"
      });
      onTransferUpdated();
    },
    onError: (error: any) => {
      toast({
        title: "Error al aprobar",
        description: error.message || "No se pudo aprobar la transferencia",
        variant: "destructive"
      });
    }
  });

  // Mutación para rechazar una transferencia
  const rejectTransferMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/transfers/${transfer.id}/reject`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia rechazada",
        description: "La transferencia ha sido rechazada",
        variant: "default"
      });
      onTransferUpdated();
    },
    onError: (error: any) => {
      toast({
        title: "Error al rechazar",
        description: error.message || "No se pudo rechazar la transferencia",
        variant: "destructive"
      });
    }
  });

  const handleApprove = () => {
    approveTransferMutation.mutate();
  };

  const handleReject = () => {
    rejectTransferMutation.mutate();
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), "d 'de' MMMM, yyyy', a las' HH:mm", { locale: es });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case "approved":
        return <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">Aprobada</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rechazada</Badge>;
      case "completed":
        return <Badge variant="success" className="bg-blue-50 text-blue-700 border-blue-200">Completada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReservationStatusBadge = (status: string, transferStatus?: string) => {
    // Si la reservación tiene un estado de transferencia específico
    if (transferStatus) {
      switch (transferStatus) {
        case "transferred":
          return <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">Transferida</Badge>;
        case "pending":
          return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
        case "rejected":
          return <Badge variant="destructive">Rechazada</Badge>;
        default:
          return <Badge variant="outline">{transferStatus}</Badge>;
      }
    }
    
    // Si no tiene un estado de transferencia, usar el estado principal
    switch (status) {
      case "confirmed":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Confirmada</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isPending = approveTransferMutation.isPending || rejectTransferMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de transferencia</DialogTitle>
            <DialogDescription>
              Información de la transferencia #{transfer.id}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Información General</TabsTrigger>
              <TabsTrigger value="reservations">Reservaciones ({transfer.reservationCount})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalles de la transferencia</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado:</span>
                      <span>{getStatusBadge(transfer.status)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha de solicitud:</span>
                      <span>{formatDate(transfer.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última actualización:</span>
                      <span>{formatDate(transfer.updatedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Empresa origen:</span>
                      <span>{transfer.sourceCompanyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Empresa destino:</span>
                      <span>{transfer.targetCompanyName}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalles del viaje</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ruta:</span>
                      <span>{transfer.tripDetails.route.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha de salida:</span>
                      <span>{format(new Date(transfer.tripDetails.departureDate), "dd/MM/yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hora de salida:</span>
                      <span>{transfer.tripDetails.departureTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origen:</span>
                      <span>{transfer.tripDetails.origin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Destino:</span>
                      <span>{transfer.tripDetails.destination}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Motivo de la transferencia</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{transfer.reason}</p>
                </CardContent>
              </Card>

              {transfer.tripDetails.route.stops.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Paradas intermedias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      {transfer.tripDetails.route.stops.map((stop, index) => (
                        <div key={index} className="flex items-center mb-4">
                          <div className="relative flex items-center justify-center">
                            <div className="h-8 w-8 rounded-full border-2 border-primary bg-background flex items-center justify-center z-10">
                              {index + 1}
                            </div>
                            {index < transfer.tripDetails.route.stops.length - 1 && (
                              <div className="absolute top-8 left-4 h-8 w-0.5 bg-muted-foreground" />
                            )}
                          </div>
                          <div className="ml-4">
                            <p className="font-medium">{stop}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="reservations" className="pt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Reservaciones</CardTitle>
                    <CardDescription>
                      Listado de reservaciones incluidas en esta transferencia
                    </CardDescription>
                  </div>
                  {canAddReservations && (
                    <Button onClick={() => setIsAddReservationOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Agregar reservación
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {!transfer.reservations || transfer.reservations.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay reservaciones asociadas a esta transferencia</p>
                      {canAddReservations && (
                        <Button 
                          variant="outline" 
                          onClick={() => setIsAddReservationOpen(true)} 
                          className="mt-4"
                        >
                          Agregar reservación
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted">
                            <th className="text-left p-3">ID</th>
                            <th className="text-left p-3">Pasajero</th>
                            <th className="text-left p-3">Asiento</th>
                            <th className="text-left p-3">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transfer.reservations.map((reservation) => (
                            <tr key={reservation.id} className="border-t">
                              <td className="p-3">{reservation.id}</td>
                              <td className="p-3">{reservation.passengerName} {reservation.passengerLastName}</td>
                              <td className="p-3">{reservation.seatNumber}</td>
                              <td className="p-3">
                                {getReservationStatusBadge(reservation.status, reservation.transferStatus)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <Separator className="my-4" />
          
          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {canApprove && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={isPending}
                  >
                    {rejectTransferMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <X className="h-4 w-4 mr-1" />
                    )}
                    Rechazar
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isPending}
                  >
                    {approveTransferMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Aprobar
                  </Button>
                </div>
              )}
            </div>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAddReservationOpen && (
        <AddReservationModal
          transferId={transfer.id}
          sourceTripId={transfer.tripId}
          isOpen={isAddReservationOpen}
          onClose={() => setIsAddReservationOpen(false)}
          onReservationAdded={onTransferUpdated}
        />
      )}
    </>
  );
};

export default TransferDetailsModal;