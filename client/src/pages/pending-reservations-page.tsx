import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Reservation, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, User as UserIcon, Calendar, Phone, Mail, CreditCard } from "lucide-react";
import { getFormattedDateTime, formatCurrency } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Tipo extendido para incluir detalles de viaje y pasajeros
type ReservationWithDetails = Reservation & {
  trip: {
    id: number;
    routeId: number;
    departureDate: string;
    price: number;
    route: {
      name: string;
      origin: string;
      destination: string;
    };
  };
  passengers: {
    id: number;
    firstName: string;
    lastName: string;
  }[];
  createdByUser?: User;
};

export default function PendingReservationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);
  const [dialogType, setDialogType] = useState<"approve" | "reject" | null>(null);

  // Obtener reservaciones pendientes de aprobación
  const { data: pendingReservations, isLoading, error, refetch } = useQuery<ReservationWithDetails[]>({
    queryKey: ["/api/reservations", "pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reservations?pendingApproval=true");
      return await res.json();
    },
  });

  // Mutación para aprobar o rechazar una reservación
  const reviewMutation = useMutation({
    mutationFn: async ({ id, approved, notes }: { id: number; approved: boolean; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/reservations/${id}/approve`, {
        approved,
        notes,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al procesar la solicitud");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reservations", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      
      toast({
        title: dialogType === "approve" ? "Reservación aprobada" : "Reservación rechazada",
        description: dialogType === "approve" 
          ? "La reservación ha sido aprobada y los asientos han sido actualizados."
          : "La reservación ha sido rechazada.",
        variant: dialogType === "approve" ? "default" : "destructive",
      });
      
      // Cerrar el diálogo después de completar la acción
      setDialogType(null);
      setSelectedReservation(null);
      setReviewNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejadores para abrir los diálogos
  const handleApprove = (reservation: ReservationWithDetails) => {
    setSelectedReservation(reservation);
    setDialogType("approve");
    setReviewNotes("");
  };

  const handleReject = (reservation: ReservationWithDetails) => {
    setSelectedReservation(reservation);
    setDialogType("reject");
    setReviewNotes("");
  };

  // Manejador para confirmar la acción
  const handleConfirm = () => {
    if (selectedReservation && dialogType) {
      reviewMutation.mutate({
        id: selectedReservation.id,
        approved: dialogType === "approve",
        notes: reviewNotes,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando reservaciones pendientes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <p className="text-destructive mb-4">Error al cargar reservaciones pendientes</p>
        <Button onClick={() => refetch()}>Intentar nuevamente</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Reservaciones Pendientes de Aprobación</h1>
          <p className="text-muted-foreground">
            Revisa y aprueba o rechaza las reservaciones creadas por comisionistas
          </p>
        </div>
        <Button onClick={() => refetch()}>
          <Loader2 className={`h-4 w-4 mr-2 ${reviewMutation.isPending ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {pendingReservations && pendingReservations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingReservations.map((reservation) => (
            <Card key={reservation.id} className="shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/40 pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">Reservación #{reservation.id}</CardTitle>
                  <Badge>Pendiente de Aprobación</Badge>
                </div>
                <CardDescription>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>Creada: {getFormattedDateTime(new Date(reservation.createdAt))}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Información del viaje */}
                  <div>
                    <h3 className="font-medium">Detalles del Viaje</h3>
                    <p className="text-sm">
                      <span className="font-semibold">{reservation.trip.route.name}</span> 
                      - Salida: {getFormattedDateTime(new Date(reservation.trip.departureDate))}
                    </p>
                    <p className="text-sm">
                      Ruta: {reservation.trip.route.origin} → {reservation.trip.route.destination}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  {/* Información del cliente */}
                  <div>
                    <h3 className="font-medium">Información del Cliente</h3>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{reservation.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{reservation.phone}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pasajeros */}
                  <div>
                    <h3 className="font-medium">Pasajeros</h3>
                    <div className="text-sm space-y-1">
                      {reservation.passengers.map((passenger) => (
                        <div key={passenger.id} className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4" />
                          <span>
                            {passenger.firstName} {passenger.lastName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Información de pago */}
                  <div>
                    <h3 className="font-medium">Información de Pago</h3>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Método: {reservation.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}</span>
                      </div>
                      <div className="flex items-center justify-between font-semibold">
                        <span>Total:</span>
                        <span>{formatCurrency(reservation.totalAmount)}</span>
                      </div>
                      {reservation.advanceAmount && reservation.advanceAmount > 0 && (
                        <div className="flex items-center justify-between">
                          <span>Anticipo ({reservation.advancePaymentMethod}):</span>
                          <span>{formatCurrency(reservation.advanceAmount)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span>Estado de pago:</span>
                        <Badge variant={reservation.paymentStatus === "pagado" ? "outline" : "default"} 
                               className={reservation.paymentStatus === "pagado" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                          {reservation.paymentStatus === "pagado" ? "PAGADO" : "PENDIENTE"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Información del comisionista */}
                  {reservation.createdByUser && (
                    <div>
                      <h3 className="font-medium">Comisionista</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <UserIcon className="h-4 w-4" />
                        <span>
                          {reservation.createdByUser.firstName} {reservation.createdByUser.lastName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between gap-2 pt-2 pb-4">
                <Button 
                  variant="destructive" 
                  onClick={() => handleReject(reservation)}
                  disabled={reviewMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => handleApprove(reservation)}
                  disabled={reviewMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aprobar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-12 mt-4">
          <div className="text-muted-foreground text-center mb-4">
            <h2 className="text-xl font-semibold">No hay reservaciones pendientes</h2>
            <p>Todas las reservaciones han sido revisadas</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            Verificar nuevamente
          </Button>
        </div>
      )}

      {/* Diálogo de confirmación para aprobar o rechazar */}
      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "approve" ? "Aprobar Reservación" : "Rechazar Reservación"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "approve" 
                ? "Estás a punto de aprobar esta reservación. Los asientos se reservarán para estos pasajeros."
                : "Estás a punto de rechazar esta reservación. Esta acción no se puede deshacer."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              {dialogType === "approve" ? "Notas (opcional)" : "Motivo del rechazo"}
            </label>
            <Textarea
              id="notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={dialogType === "approve" 
                ? "Añadir notas opcionales..." 
                : "Ingresa el motivo del rechazo..."}
              className="w-full"
              rows={3}
              required={dialogType === "reject"}
            />
          </div>

          <DialogFooter className="flex sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setDialogType(null)}
              disabled={reviewMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant={dialogType === "approve" ? "default" : "destructive"}
              onClick={handleConfirm}
              disabled={reviewMutation.isPending || (dialogType === "reject" && !reviewNotes.trim())}
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogType === "approve" ? "Confirmar Aprobación" : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}