import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface Reservation {
  id: number;
  passengerName: string;
  passengerLastName: string;
  seatNumber: number;
  status: string;
  alreadyTransferred?: boolean;
}

interface AddReservationModalProps {
  transferId: number;
  sourceTripId: number;
  isOpen: boolean;
  onClose: () => void;
  onReservationAdded: () => void;
}

export const AddReservationModal = ({ 
  transferId, 
  sourceTripId, 
  isOpen, 
  onClose, 
  onReservationAdded 
}: AddReservationModalProps) => {
  const { toast } = useToast();
  const [selectedReservations, setSelectedReservations] = useState<number[]>([]);
  
  // Cargar reservaciones disponibles para transferir
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["/api/reservations/transferable", sourceTripId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/transferable?tripId=${sourceTripId}`);
      if (!response.ok) {
        throw new Error("No se pudieron cargar las reservaciones");
      }
      return response.json();
    },
    enabled: isOpen
  });
  
  // Manejar agregar reservaciones a la transferencia
  const addReservationsMutation = useMutation({
    mutationFn: async (reservationIds: number[]) => {
      const response = await apiRequest("POST", `/api/transfers/${transferId}/reservations`, {
        reservationIds
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservaciones agregadas",
        description: "Las reservaciones han sido agregadas a la transferencia",
      });
      setSelectedReservations([]);
      onReservationAdded();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron agregar las reservaciones",
        variant: "destructive"
      });
    }
  });
  
  const handleToggleReservation = (id: number) => {
    setSelectedReservations(prev => {
      if (prev.includes(id)) {
        return prev.filter(reservationId => reservationId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  const handleSubmit = () => {
    if (selectedReservations.length === 0) {
      toast({
        title: "Selecciona reservaciones",
        description: "Debes seleccionar al menos una reservación para transferir",
        variant: "destructive"
      });
      return;
    }
    
    addReservationsMutation.mutate(selectedReservations);
  };
  
  const getReservationStatusBadge = (status: string) => {
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
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Agregar reservaciones a la transferencia</DialogTitle>
          <DialogDescription>
            Selecciona las reservaciones que deseas incluir en esta transferencia
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {!isLoading && reservations && reservations.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No hay reservaciones disponibles para transferir</p>
          </div>
        )}
        
        {!isLoading && reservations && reservations.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Pasajero</TableHead>
                  <TableHead>Asiento</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation: Reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedReservations.includes(reservation.id)}
                        onCheckedChange={() => handleToggleReservation(reservation.id)}
                        disabled={reservation.alreadyTransferred || addReservationsMutation.isPending}
                      />
                    </TableCell>
                    <TableCell>
                      {reservation.passengerName} {reservation.passengerLastName}
                    </TableCell>
                    <TableCell>{reservation.seatNumber}</TableCell>
                    <TableCell>
                      {reservation.alreadyTransferred ? (
                        <Badge variant="outline" className="bg-gray-100 text-gray-700">Ya transferida</Badge>
                      ) : (
                        getReservationStatusBadge(reservation.status)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={addReservationsMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              addReservationsMutation.isPending || 
              selectedReservations.length === 0 ||
              !reservations ||
              reservations.length === 0
            }
          >
            {addReservationsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agregando...
              </>
            ) : (
              "Agregar seleccionadas"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddReservationModal;