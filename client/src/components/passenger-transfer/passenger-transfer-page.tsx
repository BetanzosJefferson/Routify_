import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PageTitle } from "@/components/ui/page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRightLeft, Users, Calendar } from "lucide-react";
import { ReservationWithDetails } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useReservations } from "@/hooks/use-reservations";
import { normalizeToStartOfDay } from "@/lib/utils";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PassengerTransferPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title="Transferencia de pasajeros" description="Gestión de transferencias de pasajeros entre viajes" />
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transferencia de pasajeros</CardTitle>
          <CardDescription>
            Desde esta sección puede gestionar la transferencia de pasajeros entre diferentes viajes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="mt-2"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transferir pasajeros
          </Button>
        </CardContent>
      </Card>
      
      {/* Modal de selección de reservaciones */}
      <ReservationSelectionModal 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
      />
    </div>
  );
}

interface ReservationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ReservationSelectionModal({ isOpen, onClose }: ReservationSelectionModalProps) {
  // Cargar reservaciones actuales y futuras
  const { data: reservations, isLoading, error } = useReservations();
  
  // Estado para rastrear reservaciones seleccionadas
  const [selectedReservations, setSelectedReservations] = useState<Record<number, boolean>>({});
  // Estado para rastrear selección de viajes completos
  const [selectedTrips, setSelectedTrips] = useState<Record<number, boolean>>({});
  
  // Manejar selección/deselección individual
  const handleReservationSelect = (reservationId: number) => {
    setSelectedReservations(prev => ({
      ...prev,
      [reservationId]: !prev[reservationId]
    }));
  };
  
  // Manejar selección/deselección de todas las reservaciones de un viaje
  const handleTripSelect = (tripId: number, tripReservations: ReservationWithDetails[]) => {
    const newTripSelected = !selectedTrips[tripId];
    setSelectedTrips(prev => ({
      ...prev,
      [tripId]: newTripSelected
    }));
    
    // Actualizar todas las reservaciones de este viaje
    const newSelectedReservations = { ...selectedReservations };
    tripReservations.forEach(reservation => {
      newSelectedReservations[reservation.id] = newTripSelected;
    });
    setSelectedReservations(newSelectedReservations);
  };
  
  // Agrupar reservaciones por viaje
  const groupedReservations = React.useMemo(() => {
    if (!reservations) return {};
    
    const today = normalizeToStartOfDay(new Date());
    
    // Filtrar solo reservaciones confirmadas y cuya fecha sea hoy o futura
    const activeReservations = reservations.filter(reservation => {
      if (reservation.status !== 'confirmed') return false;
      
      // Verificar la fecha del viaje
      const tripDate = normalizeToStartOfDay(new Date(reservation.trip.departureDate));
      return tripDate >= today;
    });
    
    // Agrupar por tripId
    return activeReservations.reduce((groups: Record<string, ReservationWithDetails[]>, reservation) => {
      const key = reservation.tripId.toString();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(reservation);
      return groups;
    }, {});
  }, [reservations]);
  
  // Ordenar viajes por fecha
  const sortedTrips = React.useMemo(() => {
    if (!groupedReservations) return [];
    
    return Object.entries(groupedReservations)
      .map(([tripId, reservations]) => ({
        tripId: Number(tripId),
        tripInfo: reservations[0].trip, // Usamos la info del primer viaje
        reservations
      }))
      .sort((a, b) => {
        // Ordenar por fecha de salida
        const dateA = new Date(a.tripInfo.departureDate);
        const dateB = new Date(b.tripInfo.departureDate);
        return dateA.getTime() - dateB.getTime();
      });
  }, [groupedReservations]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservaciones disponibles para transferencia</DialogTitle>
          <DialogDescription>
            Seleccione reservaciones para transferir pasajeros entre viajes
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Cargando reservaciones...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            Error al cargar reservaciones. Intente nuevamente.
          </div>
        ) : sortedTrips.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay reservaciones disponibles para transferir.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedTrips.map(trip => (
              <Card key={trip.tripId} className="overflow-hidden">
                <CardHeader className="bg-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {trip.tripInfo.route.name}
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(trip.tripInfo.departureDate), "EEEE d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                        <Badge className="ml-3" variant="outline">
                          {trip.reservations.length} reservaciones
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedTrips[trip.tripId] || false}
                          onChange={() => handleTripSelect(trip.tripId, trip.reservations)}
                        />
                        <span>Seleccionar todo</span>
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Pasajeros</TableHead>
                        <TableHead>Método de pago</TableHead>
                        <TableHead>Estado de pago</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trip.reservations.slice(0, 3).map(reservation => (
                        <TableRow key={reservation.id}>
                          <TableCell className="font-medium">{reservation.id}</TableCell>
                          <TableCell>
                            <div className="text-sm">{reservation.email}</div>
                            <div className="text-xs text-muted-foreground">{reservation.phone}</div>
                          </TableCell>
                          <TableCell>
                            {reservation.passengers?.length || 0} pasajeros
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {reservation.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {reservation.paymentStatus === 'pagado' ? (
                              <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                                Pagado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                Pendiente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={selectedReservations[reservation.id] || false}
                                onChange={() => handleReservationSelect(reservation.id)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {trip.reservations.length > 3 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            {trip.reservations.length - 3} reservaciones más...
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Botones de acción */}
        <div className="mt-6 flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          
          <Button 
            disabled={Object.values(selectedReservations).filter(Boolean).length === 0}
            onClick={() => {
              // Obtener IDs de reservaciones seleccionadas
              const selectedIds = Object.entries(selectedReservations)
                .filter(([_, isSelected]) => isSelected)
                .map(([id]) => Number(id));
              
              console.log("Reservaciones seleccionadas:", selectedIds);
              
              // Mostrar un mensaje temporal en la consola
              alert(`Seleccionadas ${selectedIds.length} reservaciones para transferencia. Función en desarrollo.`);
              
              // Cerrar el modal
              onClose();
            }}
          >
            Continuar con {Object.values(selectedReservations).filter(Boolean).length} seleccionada(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}