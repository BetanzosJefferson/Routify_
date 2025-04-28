import { useState, useEffect } from "react";
import { ReservationWithDetails } from "@shared/schema";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Calendar, Clock, MapPin, Users, CreditCard, TicketIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ReservationDetailsModalProps {
  reservation: ReservationWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReservationDetailsModal({ reservation, isOpen, onClose }: ReservationDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (reservation && isOpen) {
      generateQRCode();
    }
  }, [reservation, isOpen]);

  // Generar código QR con los datos de la reservación
  const generateQRCode = async () => {
    if (!reservation) return;
    
    try {
      // Creamos un objeto con la información relevante para el QR
      const qrData = {
        id: reservation.id,
        reservationId: generateReservationId(reservation.id),
        passengerName: `${reservation.passengers[0]?.firstName} ${reservation.passengers[0]?.lastName}`,
        route: reservation.trip.route.name,
        origin: reservation.trip.segmentOrigin || reservation.trip.route.origin,
        destination: reservation.trip.segmentDestination || reservation.trip.route.destination,
        date: formatDate(reservation.trip.departureDate),
        time: reservation.trip.departureTime,
        totalAmount: reservation.totalAmount,
        paymentStatus: reservation.paymentStatus,
        advanceAmount: reservation.advanceAmount || 0,
        remainingAmount: reservation.advanceAmount ? (reservation.totalAmount - reservation.advanceAmount) : reservation.totalAmount,
        paymentMethod: reservation.paymentMethod,
        advancePaymentMethod: reservation.advancePaymentMethod,
        passengers: reservation.passengers.length
      };
      
      // Codificamos los datos para incluirlos como parámetro en la URL
      const encodedData = encodeURIComponent(JSON.stringify(qrData));
      const reservationUrl = `${window.location.origin}/reservation-view?data=${encodedData}`;
      
      // Generamos el código QR con la URL completa
      const qrCodeData = await QRCode.toDataURL(reservationUrl);
      setQrCodeUrl(qrCodeData);
    } catch (error) {
      console.error("Error al generar QR:", error);
    }
  };

  // Mutation para marcar como pagada una reservación
  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!reservation) return null;
      
      const response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservation.id}`, 
        { paymentStatus: "pagado" }
      );
      
      if (!response.ok) {
        throw new Error("Error al marcar como pagada la reservación");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservación actualizada",
        description: "La reservación ha sido marcada como pagada exitosamente.",
      });
      
      // Invalidar queries para actualizar los datos
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      
      // Opcionalmente, cerrar el modal después de actualizar
      // onClose();
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar la reservación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Si no hay reservación, no renderizamos nada
  if (!reservation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <TicketIcon className="mr-2 h-5 w-5" />
            Detalles de la Reservación #{generateReservationId(reservation.id)}
          </DialogTitle>
          <DialogDescription>
            Información completa de la reservación
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Información de la reservación - Columna izquierda */}
          <div className="space-y-6">
            {/* Información del pasajero */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Información del pasajero</h3>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-gray-500">NOMBRE</Label>
                  <p className="font-medium">
                    {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                    {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">EMAIL</Label>
                  <p>{reservation.email || "No disponible"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">TELÉFONO</Label>
                  <p>{reservation.phone || "No disponible"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">PASAJEROS</Label>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-gray-400 mr-1" />
                    <span>{reservation.passengers.length}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Información del viaje */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Detalles del viaje</h3>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-gray-500">RUTA</Label>
                  <p className="font-medium">{reservation.trip.route.name}</p>
                </div>
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-gray-400 mr-1 mt-0.5" />
                  <div>
                    <Label className="text-xs text-gray-500 block">ORIGEN</Label>
                    <p>{reservation.trip.segmentOrigin || reservation.trip.route.origin}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-gray-400 mr-1 mt-0.5" />
                  <div>
                    <Label className="text-xs text-gray-500 block">DESTINO</Label>
                    <p>{reservation.trip.segmentDestination || reservation.trip.route.destination}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Calendar className="h-4 w-4 text-gray-400 mr-1 mt-0.5" />
                  <div>
                    <Label className="text-xs text-gray-500 block">FECHA</Label>
                    <p>{formatDate(reservation.trip.departureDate)}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Clock className="h-4 w-4 text-gray-400 mr-1 mt-0.5" />
                  <div>
                    <Label className="text-xs text-gray-500 block">HORA DE SALIDA</Label>
                    <p>{reservation.trip.departureTime}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Información de pago y QR - Columna derecha */}
          <div className="space-y-6">
            {/* Información de pago */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Información de pago</h3>
              
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <Label className="text-gray-500 text-xs">ESTADO DE PAGO</Label>
                  <Badge 
                    variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                    className={reservation.paymentStatus === 'pagado' 
                      ? "bg-green-100 text-green-800 border-green-200" 
                      : "bg-amber-100 text-amber-800 border-amber-200"}
                  >
                    {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-gray-500 text-xs">MONTO TOTAL</Label>
                  <p className="font-semibold">{formatPrice(reservation.totalAmount)}</p>
                </div>
                
                {(!reservation.advanceAmount || reservation.advanceAmount <= 0) ? (
                  <div className="flex justify-between">
                    <Label className="text-gray-500 text-xs">MÉTODO DE PAGO</Label>
                    <p>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <Label className="text-gray-500 text-xs">ANTICIPO</Label>
                      <p className="font-medium">{formatPrice(reservation.advanceAmount)}</p>
                    </div>
                    <div className="flex justify-between">
                      <Label className="text-gray-500 text-xs">MÉTODO ANTICIPO</Label>
                      <p>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                    </div>
                    
                    {reservation.advanceAmount < reservation.totalAmount && (
                      <>
                        <div className="flex justify-between">
                          <Label className="text-gray-500 text-xs">PENDIENTE DE PAGO</Label>
                          <p className="font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</p>
                        </div>
                        <div className="flex justify-between">
                          <Label className="text-gray-500 text-xs">MÉTODO PAGO FINAL</Label>
                          <p>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                        </div>
                      </>
                    )}
                  </>
                )}
                
                {reservation.paymentStatus !== 'pagado' && (
                  <Button 
                    onClick={() => markAsPaidMutation.mutate()}
                    disabled={markAsPaidMutation.isPending}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  >
                    {markAsPaidMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Marcar como pagado
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Código QR */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3 border-b pb-2">Código QR</h3>
              <div className="flex flex-col items-center justify-center">
                {qrCodeUrl ? (
                  <>
                    <img 
                      src={qrCodeUrl} 
                      alt="Código QR de la reservación" 
                      className="w-48 h-48 object-contain mb-2"
                    />
                    <div className="text-xs text-gray-500 text-center mb-3 space-y-1">
                      <p>Este código QR contiene los detalles de la reservación.</p>
                      <p>Escanea el código para ver o compartir el boleto completo.</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Abrir la URL del QR en una nueva pestaña
                        const encodedData = encodeURIComponent(JSON.stringify({
                          id: reservation.id,
                          reservationId: generateReservationId(reservation.id),
                          passengerName: `${reservation.passengers[0]?.firstName} ${reservation.passengers[0]?.lastName}`,
                          route: reservation.trip.route.name,
                          origin: reservation.trip.segmentOrigin || reservation.trip.route.origin,
                          destination: reservation.trip.segmentDestination || reservation.trip.route.destination,
                          date: formatDate(reservation.trip.departureDate),
                          time: reservation.trip.departureTime,
                          totalAmount: reservation.totalAmount,
                          paymentStatus: reservation.paymentStatus,
                          advanceAmount: reservation.advanceAmount || 0,
                          remainingAmount: reservation.advanceAmount ? (reservation.totalAmount - reservation.advanceAmount) : reservation.totalAmount,
                          paymentMethod: reservation.paymentMethod,
                          advancePaymentMethod: reservation.advancePaymentMethod,
                          passengers: reservation.passengers.length
                        }));
                        const reservationUrl = `${window.location.origin}/reservation-view?data=${encodedData}`;
                        window.open(reservationUrl, '_blank');
                      }}
                    >
                      Ver boleto completo
                    </Button>
                  </>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}