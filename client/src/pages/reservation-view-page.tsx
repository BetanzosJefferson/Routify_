import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { CheckCircle, Calendar, Clock, MapPin, Users, CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ReservationData {
  id: number;
  reservationId: string;
  passengerName: string;
  route: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  totalAmount: number;
  paymentStatus: string;
  advanceAmount: number;
  remainingAmount: number;
  passengers?: number;
  paymentMethod?: string;
  advancePaymentMethod?: string;
}

export default function ReservationViewPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extraer datos de la reservación del parámetro de URL
    const searchParams = new URLSearchParams(window.location.search);
    const reservationData = searchParams.get("data");

    if (reservationData) {
      try {
        // Decodificar y parsear los datos JSON del QR
        const decodedData = JSON.parse(decodeURIComponent(reservationData));
        setReservation(decodedData);
        setLoading(false);
      } catch (err) {
        console.error("Error al parsear datos de la reservación:", err);
        setError("No se pudieron leer los datos de la reservación. Formato inválido.");
        setLoading(false);
      }
    } else {
      setError("No se encontraron datos de reservación en la URL.");
      setLoading(false);
    }
  }, []);

  // Mutation para marcar como pagada una reservación
  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!reservation || !reservation.id) return null;
      
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
      
      // Actualizar el estado local
      if (reservation) {
        setReservation({
          ...reservation,
          paymentStatus: "pagado"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar la reservación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejar el botón para regresar a la página anterior
  const handleGoBack = () => {
    navigate("/reservations");
  };

  // Si está cargando, mostrar un indicador de carga
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Cargando información de la reservación...</p>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje de error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Error al cargar la reservación</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Button onClick={handleGoBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a reservaciones
        </Button>
      </div>
    );
  }

  // Si no hay datos de reservación, mostrar mensaje
  if (!reservation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Reservación no encontrada</h1>
        <p className="text-gray-600 mb-6">No se encontraron detalles de la reservación.</p>
        <Button onClick={handleGoBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a reservaciones
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-900">¡Reservación Confirmada!</h1>
          <p className="text-gray-600">Su reservación ha sido procesada exitosamente.</p>
        </div>

        {/* Titular */}
        <div className="text-center border-t border-b border-gray-200 py-4 mb-6">
          <h2 className="text-xl font-semibold text-blue-600">TransRoute</h2>
          <p className="text-gray-600">Boleto de Viaje Oficial</p>
        </div>

        {/* Datos principales */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-white p-6">
            <div className="border border-gray-200 rounded-md p-2 flex items-center justify-center mb-6">
              <div className="text-2xl font-semibold text-blue-600">
                {reservation.reservationId}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna izquierda */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Ruta:</h3>
                  <p className="text-base font-medium">{reservation.route}</p>
                </div>
                
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Origen:</h3>
                    <p className="text-base">{reservation.origin}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Destino:</h3>
                    <p className="text-base">{reservation.destination}</p>
                  </div>
                </div>
              </div>
              
              {/* Columna derecha */}
              <div className="space-y-4">
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Fecha:</h3>
                    <p className="text-base">{reservation.date}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Salida:</h3>
                    <p className="text-base">{reservation.time}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Users className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Pasajero:</h3>
                    <p className="text-base">{reservation.passengerName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Información de pago */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Información de pago</h3>
                <Badge 
                  variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                  className={reservation.paymentStatus === 'pagado' 
                    ? "bg-green-100 text-green-800 border-green-200" 
                    : "bg-amber-100 text-amber-800 border-amber-200"}
                >
                  {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
                <div>
                  <h4 className="text-sm text-gray-500">Monto total:</h4>
                  <p className="font-semibold">{formatPrice(reservation.totalAmount)}</p>
                </div>
                
                {reservation.advanceAmount > 0 && (
                  <>
                    <div>
                      <h4 className="text-sm text-gray-500">Anticipo:</h4>
                      <p>{formatPrice(reservation.advanceAmount)}</p>
                    </div>
                    
                    {reservation.remainingAmount > 0 && (
                      <div>
                        <h4 className="text-sm text-gray-500">Restante:</h4>
                        <p className="font-medium">{formatPrice(reservation.remainingAmount)}</p>
                      </div>
                    )}
                  </>
                )}
                
                {reservation.paymentMethod && (
                  <div>
                    <h4 className="text-sm text-gray-500">Método de pago:</h4>
                    <p>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</p>
                  </div>
                )}
              </div>
              
              {reservation.paymentStatus !== 'pagado' && (
                <Button 
                  className="w-full mt-6 bg-green-600 hover:bg-green-700"
                  onClick={() => markAsPaidMutation.mutate()}
                  disabled={markAsPaidMutation.isPending}
                >
                  {markAsPaidMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Marcar como pagado
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>
        
        {/* Pie de página */}
        <div className="text-center">
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a reservaciones
          </Button>
          
          <p className="mt-6 text-xs text-gray-500">
            Por favor, conserve este boleto y preséntelo al abordar.
            <br />
            Si tiene preguntas, contacte a nuestro servicio al cliente.
          </p>
        </div>
      </div>
    </div>
  );
}