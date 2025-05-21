import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PageTitle } from "@/components/ui/page-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRightLeft, Users, Calendar, Check, History } from "lucide-react";
import { ReservationWithDetails, Company } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useReservations } from "@/hooks/use-reservations";
import { normalizeToStartOfDay } from "@/lib/utils";
import { CompanySelectionModal } from "./company-selection-modal";
import { TransferHistory } from "./transfer-history";
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
  const [showCompanySelection, setShowCompanySelection] = useState(false);
  const [selectedReservationIds, setSelectedReservationIds] = useState<number[]>([]);
  const [selectedReservations, setSelectedReservations] = useState<Record<number, boolean>>({});
  const [selectedTrips, setSelectedTrips] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Mutación para transferir reservaciones
  const transferMutation = useMutation({
    mutationFn: async ({ reservationIds, targetCompanyId }: { reservationIds: number[], targetCompanyId: string }) => {
      console.log("Enviando solicitud de transferencia:", {
        reservationIds,
        targetCompanyId
      });
      
      try {
        const response = await apiRequest("POST", "/api/reservations/transfer", {
          reservationIds,
          targetCompanyId
        });
        
        console.log("Respuesta de transferencia recibida:", response.status);
        const data = await response.json();
        console.log("Datos de transferencia:", data);
        return data;
      } catch (error) {
        console.error("Error en solicitud de transferencia:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Mostrar toast de éxito
      toast({
        title: "Transferencia exitosa",
        description: data.message,
        variant: "default",
      });
      
      // Invalidar consultas relacionadas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      
      // Cerrar los modales
      setShowCompanySelection(false);
      setIsDialogOpen(false);
      
      // Limpiar el estado
      setSelectedReservationIds([]);
      setSelectedReservations({});
      setSelectedTrips({});
    },
    onError: (error: any) => {
      // Mostrar toast de error
      toast({
        title: "Error al transferir",
        description: error.message || "Ha ocurrido un error al transferir las reservaciones.",
        variant: "destructive",
      });
      
      // Mantener el modal abierto para permitir reintentar
      console.error("Error al transferir reservaciones:", error);
    }
  });
  
  // Manejar la selección de una empresa
  const handleCompanySelected = (company: Company) => {
    console.log(`Empresa seleccionada: ${company.name} (${company.identifier})`);
    console.log(`Transferir reservaciones: ${selectedReservationIds.join(', ')} a empresa ${company.identifier}`);
    
    // Ejecutar la mutación para transferir reservaciones
    transferMutation.mutate({
      reservationIds: selectedReservationIds,
      targetCompanyId: company.identifier
    });
  };
  
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
      
      {/* Historial de transferencias */}
      <TransferHistory />
      
      {/* Modal de selección de reservaciones */}
      <ReservationSelectionModal 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        selectedReservations={selectedReservations}
        setSelectedReservations={setSelectedReservations}
        selectedTrips={selectedTrips}
        setSelectedTrips={setSelectedTrips}
        setSelectedReservationIds={setSelectedReservationIds}
        setShowCompanySelection={setShowCompanySelection}
      />
      
      {/* Modal de selección de empresa */}
      <CompanySelectionModal
        isOpen={showCompanySelection}
        onClose={() => setShowCompanySelection(false)}
        selectedReservationIds={selectedReservationIds}
        onCompanySelected={handleCompanySelected}
      />
    </div>
  );
}

interface ReservationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReservations: Record<number, boolean>;
  setSelectedReservations: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  selectedTrips: Record<number, boolean>;
  setSelectedTrips: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setSelectedReservationIds: React.Dispatch<React.SetStateAction<number[]>>;
  setShowCompanySelection: React.Dispatch<React.SetStateAction<boolean>>;
}

function ReservationSelectionModal({ 
  isOpen, 
  onClose, 
  selectedReservations, 
  setSelectedReservations, 
  selectedTrips, 
  setSelectedTrips,
  setSelectedReservationIds,
  setShowCompanySelection
}: ReservationSelectionModalProps) {
  // Cargar reservaciones actuales y futuras
  const { data: reservations, isLoading, error } = useReservations();
  
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
    
    // IMPORTANTE: Usar la misma fecha de sistema que usamos para clasificar reservaciones (20/05/2025)
    // en lugar de la fecha real del sistema (21/05/2025)
    const SYSTEM_DATE = new Date('2025-05-20T12:00:00.000Z');
    console.log(`[TransferModal] Usando fecha del sistema: ${SYSTEM_DATE.toISOString()}`);
    const today = normalizeToStartOfDay(SYSTEM_DATE);
    
    // Filtrar solo reservaciones confirmadas y cuya fecha sea hoy o futura
    const activeReservations = reservations.filter(reservation => {
      if (reservation.status !== 'confirmed') return false;
      
      // Verificar la fecha del viaje
      const tripDate = normalizeToStartOfDay(new Date(reservation.trip.departureDate));
      const isEligible = tripDate >= today;
      console.log(`[TransferModal] Evaluando reservación ${reservation.id}: Fecha viaje ${tripDate.toISOString()}, ¿Elegible? ${isEligible ? 'SÍ' : 'NO'}`);
      return isEligible;
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
              
              // Guardar IDs seleccionadas y abrir el modal de selección de empresa
              setSelectedReservationIds(selectedIds);
              setShowCompanySelection(true);
              onClose(); // Cerrar el modal actual
            }}
          >
            Continuar con {Object.values(selectedReservations).filter(Boolean).length} seleccionada(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}