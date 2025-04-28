import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import QRCode from "qrcode";
import { ReservationWithDetails } from "@shared/schema";
import { PaymentMethod, PaymentStatus } from "@shared/constants";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Cargar detalles de la reservación
  const { data: reservation, isLoading, error } = useQuery<ReservationWithDetails>({
    queryKey: [`/api/reservations/${id}`],
    enabled: !!id,
  });

  // Generar URL del código QR cuando se cargue la reservación
  useEffect(() => {
    if (reservation) {
      const reservationUrl = `${window.location.origin}/reservations/${reservation.id}`;
      QRCode.toDataURL(reservationUrl)
        .then((url: string) => {
          setQrCodeUrl(url);
        })
        .catch((err: Error) => {
          console.error("Error generando código QR", err);
        });
    }
  }, [reservation]);

  // Manejar el marcado de pago
  const handleMarkAsPaid = async () => {
    if (!reservation) return;
    
    try {
      const response = await fetch(`/api/reservations/${id}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al marcar como pagado');
      }
      
      // Recargar la página para mostrar el estado actualizado
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('No se pudo marcar como pagado. Inténtelo de nuevo.');
    }
  };

  // Función para imprimir el boleto
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando detalles de la reservación...</span>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500">Error</h1>
        <p className="mt-2">No se pudo cargar la reservación. Por favor intente nuevamente.</p>
        <Button onClick={() => navigate("/")} className="mt-4">
          Volver al inicio
        </Button>
      </div>
    );
  }

  const isPaid = reservation.paymentStatus === PaymentStatus.PAID;
  
  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="print:hidden mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate("/reservations")}
          className="mb-4"
        >
          &larr; Volver
        </Button>
        <h1 className="text-2xl font-bold">Detalles de la Reservación</h1>
        <p className="text-gray-500">Ver información completa de tu reservación</p>
      </div>
      
      <Card className="mb-6 print:shadow-none print:border-none">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle>TransRoute</CardTitle>
            <p className="text-sm text-gray-500">Boleto de Viaje Oficial</p>
          </div>
          <Badge 
            variant={isPaid ? "outline" : "secondary"}
            className={isPaid
              ? "bg-green-100 text-green-800 border-green-200" 
              : "bg-amber-100 text-amber-800 border-amber-200"}
          >
            {isPaid ? 'PAGADO' : 'PENDIENTE'}
          </Badge>
        </CardHeader>
        
        <CardContent className="pt-4">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="font-bold text-lg">#{generateReservationId(reservation.id)}</p>
              <p className="text-sm text-gray-500">Creado: {new Date(reservation.createdAt).toLocaleDateString()}</p>
            </div>
            {qrCodeUrl && (
              <div className="text-center">
                <img 
                  src={qrCodeUrl} 
                  alt="Código QR de la reservación" 
                  className="w-24 h-24"
                />
                <p className="text-xs text-gray-500 mt-1">Escanea para verificar</p>
              </div>
            )}
          </div>
          
          <Separator className="my-4" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Información del Viaje</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-500">Ruta:</p>
                  <p className="font-medium">{reservation.trip.route.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Origen:</p>
                  <p className="font-medium">{reservation.trip.segmentOrigin || reservation.trip.route.origin}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Destino:</p>
                  <p className="font-medium">{reservation.trip.segmentDestination || reservation.trip.route.destination}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha:</p>
                  <p className="font-medium">{formatDate(reservation.trip.departureDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hora de Salida:</p>
                  <p className="font-medium">{reservation.trip.departureTime}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Hora de Llegada:</p>
                  <p className="font-medium">{reservation.trip.arrivalTime}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Pasajeros</h3>
              <div className="space-y-1">
                {reservation.passengers.map((passenger, index) => (
                  <p key={index} className="text-medium">
                    {index + 1}. {passenger.firstName} {passenger.lastName}
                  </p>
                ))}
              </div>
              
              <div className="mt-4">
                <h3 className="font-semibold text-gray-700 mb-2">Información de Contacto</h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">Email:</p>
                    <p className="font-medium">{reservation.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Teléfono:</p>
                    <p className="font-medium">{reservation.phone}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">Información de Pago</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <p className="text-gray-700">Total ({reservation.passengers.length} pasajeros):</p>
                <p className="font-bold">{formatPrice(reservation.totalAmount)}</p>
              </div>
              
              {(!reservation.advanceAmount || reservation.advanceAmount <= 0) ? (
                <div className="flex justify-between">
                  <p className="text-gray-700">Método de pago:</p>
                  <p>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <p className="text-gray-700">Anticipo:</p>
                    <p>{formatPrice(reservation.advanceAmount)}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-gray-700">Método anticipo:</p>
                    <p>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                  </div>
                  
                  {reservation.advanceAmount < reservation.totalAmount && (
                    <>
                      <div className="flex justify-between">
                        <p className="text-gray-700">Resta:</p>
                        <p className="font-semibold">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-gray-700">Método restante:</p>
                        <p>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            
            {(reservation.paymentMethod === 'transferencia' || 
              (reservation.advanceAmount > 0 && reservation.advancePaymentMethod === 'transferencia')) && (
              <div className="mt-4 p-3 border border-blue-200 rounded bg-blue-50 text-sm text-blue-800">
                <p className="font-semibold mb-1">Información Bancaria:</p>
                <p>Banco: BBVA</p>
                <p>Titular: TransRoute S.A. de C.V.</p>
                <p>CLABE: 0123 4567 8901 2345 67</p>
                <p className="mt-1">Verifica tu pago: 555-123-4567</p>
              </div>
            )}
          </div>
          
          <div className="print:hidden flex flex-col sm:flex-row gap-2 mt-6">
            <Button 
              onClick={handlePrint} 
              variant="outline" 
              className="flex-1"
            >
              Imprimir Boleto
            </Button>
            
            {!isPaid && (
              <Button 
                onClick={handleMarkAsPaid} 
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Marcar como Pagado
              </Button>
            )}
          </div>
          
          <div className="text-center text-sm text-gray-500 mt-6">
            <p>Presente este boleto al abordar el vehículo</p>
            {!isPaid && (
              <p className="mt-1 text-amber-600 font-semibold">
                IMPORTANTE: Complete el pago antes de abordar
              </p>
            )}
            <p className="mt-1">TransRoute © {new Date().getFullYear()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}