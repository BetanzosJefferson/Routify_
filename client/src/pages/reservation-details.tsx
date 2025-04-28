import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ReservationDetails() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [reservationId, setReservationId] = useState<number | null>(null);
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);

  // Extraer el ID de la reservación de la URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id) {
      setReservationId(parseInt(id, 10));
    }
  }, []);

  // Cargar los detalles de la reservación usando el endpoint público
  const { data: reservation, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/public/reservations", reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      const response = await fetch(`/api/public/reservations/${reservationId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles de la reservación");
      }
      return response.json();
    },
    enabled: !!reservationId,
  });

  // Función para marcar como pagado
  const markAsPaid = async () => {
    if (!reservationId) return;
    
    setIsMarkingAsPaid(true);
    try {
      // Primero intentamos hacer la solicitud (esto probablemente fallará si no está autenticado)
      let response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservationId}`, 
        { paymentStatus: "pagado" }
      );
      
      // Si la solicitud falla, mostramos un mensaje indicando que se necesita autenticación
      if (!response.ok) {
        toast({
          title: "Autenticación requerida",
          description: "Para marcar como pagado necesita iniciar sesión con una cuenta autorizada.",
          variant: "destructive",
        });
        
        // Opcionalmente, podríamos redirigir a la página de inicio de sesión
        // setLocation("/auth");
        return;
      }
      
      toast({
        title: "Pago actualizado",
        description: "La reservación ha sido marcada como pagada.",
        variant: "default",
      });
      
      // Recargar los datos para mostrar el cambio
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsPaid(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-center text-gray-700">Cargando detalles de la reservación...</p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <XCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-center mb-2">Reservación no encontrada</h1>
        <p className="text-gray-600 text-center mb-6">
          No se encontró la reservación solicitada o ha ocurrido un error.
        </p>
        <Button onClick={() => setLocation("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <Button 
        variant="outline" 
        className="mb-6"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>
      
      <Card className="p-6 mb-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Reservación #{generateReservationId(reservation.id)}
          </h1>
          <Badge 
            variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
            className={reservation.paymentStatus === 'pagado' 
              ? "bg-green-100 text-green-700 border-green-200 text-xs px-3 py-1" 
              : "bg-amber-100 text-amber-700 border-amber-200 text-xs px-3 py-1"}
          >
            {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
          </Badge>
        </div>

        {/* Información del pasajero */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-3 text-gray-800">Información del Pasajero</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Nombre:</div>
                <div className="font-medium">
                  {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                  {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Contacto:</div>
                <div>{reservation.email || '-'}</div>
                <div>{reservation.phone || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detalles del viaje */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-3 text-gray-800">Detalles del Viaje</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="mb-3">
              <div className="text-sm text-gray-500">Ruta:</div>
              <div className="font-medium">{reservation.trip.route.name}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-gray-500">Origen:</div>
                <div>{reservation.trip.segmentOrigin || reservation.trip.route.origin}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Destino:</div>
                <div>{reservation.trip.segmentDestination || reservation.trip.route.destination}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Fecha:</div>
                <div>{formatDate(reservation.trip.departureDate)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Hora:</div>
                <div>{reservation.trip.departureTime}</div>
              </div>
            </div>
            
            <div className="mt-3">
              <div className="text-sm text-gray-500">Pasajeros:</div>
              <div>{reservation.passengers.length}</div>
            </div>
          </div>
        </div>

        {/* Información de pago */}
        <div>
          <h2 className="text-lg font-medium mb-3 text-gray-800">Información de Pago</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-gray-500">Total:</div>
                <div className="text-lg font-bold">{formatPrice(reservation.totalAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Estado:</div>
                <div className={`font-semibold ${
                  reservation.paymentStatus === 'pagado' 
                    ? 'text-green-600' 
                    : 'text-amber-600'
                }`}>
                  {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                </div>
              </div>
            </div>
            
            {(!reservation.advanceAmount || reservation.advanceAmount <= 0) ? (
              <div>
                <div className="text-sm text-gray-500">Método de pago:</div>
                <div>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Anticipo:</div>
                    <div className="font-medium">{formatPrice(reservation.advanceAmount)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Método anticipo:</div>
                    <div>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                  </div>
                </div>
                
                {reservation.advanceAmount < reservation.totalAmount && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="text-sm text-gray-500">Pendiente:</div>
                      <div className="font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Método pago final:</div>
                      <div>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Botón para marcar como pagado */}
        {reservation.paymentStatus !== 'pagado' && (
          <div className="mt-6">
            <Button 
              onClick={markAsPaid} 
              disabled={isMarkingAsPaid}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isMarkingAsPaid ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Marcar como pagado
                </>
              )}
            </Button>
          </div>
        )}

        {/* Notas */}
        {reservation.notes && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-3 text-gray-800">Notas</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <p>{reservation.notes}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}