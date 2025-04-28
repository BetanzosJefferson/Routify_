import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
// Constantes para los estados de pago
const PaymentStatus = {
  PAID: 'pagado',
  PENDING: 'pendiente',
  CANCELLED: 'cancelado'
};

// Constantes para los métodos de pago
const PaymentMethod = {
  CASH: 'efectivo',
  TRANSFER: 'transferencia'
};
import { QrCodeIcon, PrinterIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon, CreditCardIcon } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ReservationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false);

  // Cargar los detalles de la reservación
  const {
    data: reservation,
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/reservations', parseInt(id)],
    queryFn: getQueryFn({
      customUrl: `/api/reservations/${id}?public=true`, 
      on401: "returnNull"
    }),
  });

  // Mutation para marcar como pagada
  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/reservations/${id}/mark-paid`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al marcar la reservación como pagada");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservación pagada",
        description: "La reservación ha sido marcada como pagada correctamente.",
        variant: "default"
      });

      // Refrescar los datos de la reservación
      queryClient.invalidateQueries({
        queryKey: ['/api/reservations', parseInt(id)]
      });

      // Cerrar el modal
      setIsMarkPaidModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo marcar la reservación como pagada.",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    // Generar el código QR cuando se cargue la reservación
    if (reservation) {
      const reservationUrl = `${window.location.origin}/reservations/${reservation.id}`;
      QRCode.toDataURL(reservationUrl)
        .then((url: string) => {
          setQrCodeUrl(url);
        })
        .catch((err: Error) => {
          console.error("Error generando QR:", err);
        });
    }
  }, [reservation]);

  // Manejar la impresión
  const handlePrint = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 100);
  };

  // Si está cargando, mostrar skeleton
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-2/5 mb-2" />
            <Skeleton className="h-4 w-3/5" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4 mb-2" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4 mb-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje
  if (error || !reservation) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Error al cargar la reservación</CardTitle>
            <CardDescription>
              No se pudo encontrar la información de la reservación solicitada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle>Reservación no encontrada</AlertTitle>
              <AlertDescription>
                No se pudo cargar la reservación. Verifique que el enlace sea correcto o contacte a soporte.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate("/")}>
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Determinar si está pagado
  const isPaid = reservation.paymentStatus === PaymentStatus.PAID;
  const pendingAmount = reservation.totalAmount - (reservation.advanceAmount || 0);

  return (
    <div className={`container mx-auto py-8 ${isPrintMode ? 'print-mode' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-mode, .print-mode * {
            visibility: visible;
          }
          .print-mode {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="mb-6 no-print">
        <Button
          variant="outline"
          className="mb-4"
          onClick={() => navigate("/")}
        >
          ← Volver
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader className="relative">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Detalles de Reservación</CardTitle>
              <CardDescription>
                Reservación #{generateReservationId(reservation.id)}
              </CardDescription>
            </div>
            
            <Badge 
              variant={isPaid ? "outline" : "secondary"}
              className={isPaid
                ? "bg-green-100 text-green-800 border-green-200" 
                : "bg-amber-100 text-amber-800 border-amber-200"}
            >
              {isPaid ? 'PAGADO' : 'PENDIENTE'}
            </Badge>
          </div>

          {!isPrintMode && (
            <div className="absolute right-6 top-6 flex space-x-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <h3 className="font-medium text-lg mb-3">Información del Viaje</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-medium text-gray-500">Ruta:</div>
                  <div className="text-sm col-span-2">{reservation.trip.route.name}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-medium text-gray-500">Origen:</div>
                  <div className="text-sm col-span-2">{reservation.trip.segmentOrigin || reservation.trip.route.origin}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-medium text-gray-500">Destino:</div>
                  <div className="text-sm col-span-2">{reservation.trip.segmentDestination || reservation.trip.route.destination}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-medium text-gray-500">Fecha:</div>
                  <div className="text-sm col-span-2">{formatDate(reservation.trip.departureDate)}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-medium text-gray-500">Salida:</div>
                  <div className="text-sm col-span-2">{reservation.trip.departureTime}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-medium text-gray-500">Llegada:</div>
                  <div className="text-sm col-span-2">{reservation.trip.arrivalTime || 'No especificada'}</div>
                </div>
              </div>
            </div>

            <div className="md:border-l md:pl-6 flex items-center justify-center">
              {qrCodeUrl && (
                <div className="text-center">
                  <img 
                    src={qrCodeUrl} 
                    alt="Código QR de la reservación" 
                    className="w-32 h-32 mx-auto mb-2"
                  />
                  <p className="text-xs text-gray-500">Código de verificación</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium text-lg mb-3">Pasajeros</h3>
            <ul className="space-y-2">
              {reservation.passengers.map((passenger, index) => (
                <li key={index} className="text-sm">
                  {index + 1}. {passenger.firstName} {passenger.lastName}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <h3 className="font-medium text-lg mb-3">Información de Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <div className="bg-primary bg-opacity-10 p-2 rounded-full">
                  <CreditCardIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Email</div>
                  <div className="text-sm text-gray-500">{reservation.email}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="bg-primary bg-opacity-10 p-2 rounded-full">
                  <PrinterIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Teléfono</div>
                  <div className="text-sm text-gray-500">{reservation.phone}</div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="bg-gray-50 p-4 rounded-md border">
            <h3 className="font-medium text-lg mb-3">Información de Pago</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm font-medium text-gray-500">Precio total:</div>
                <div className="text-sm font-bold">{formatPrice(reservation.totalAmount)}</div>
              </div>
              
              {reservation.advanceAmount > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm font-medium text-gray-500">Anticipo:</div>
                    <div className="text-sm">{formatPrice(reservation.advanceAmount)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm font-medium text-gray-500">Método del anticipo:</div>
                    <div className="text-sm">
                      {reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                    </div>
                  </div>
                  
                  {pendingAmount > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium text-gray-500">Pendiente de pago:</div>
                        <div className="text-sm font-bold text-amber-600">{formatPrice(pendingAmount)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium text-gray-500">Método para el resto:</div>
                        <div className="text-sm">
                          {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              
              {(!reservation.advanceAmount || reservation.advanceAmount <= 0) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm font-medium text-gray-500">Método de pago:</div>
                  <div className="text-sm">
                    {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm font-medium text-gray-500">Estado:</div>
                <div className={`text-sm font-bold ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                  {isPaid ? 'PAGADO' : 'PENDIENTE DE PAGO'}
                </div>
              </div>
            </div>

            {!isPaid && (
              <div className="mt-4 no-print">
                <Button 
                  onClick={() => setIsMarkPaidModalOpen(true)}
                  className="w-full"
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Marcar como Pagado
                </Button>
                
                <div className="mt-2 text-center text-xs text-gray-500">
                  Esta acción confirmará que el pago ha sido recibido completamente.
                </div>
              </div>
            )}

            {isPaid && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3 flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                <div className="text-sm text-green-700">
                  El pago de esta reservación ha sido completado y verificado.
                </div>
              </div>
            )}
          </div>
          
          {reservation.notes && (
            <div>
              <h3 className="font-medium text-lg mb-2">Notas</h3>
              <div className="text-sm bg-gray-50 p-3 rounded border">
                {reservation.notes}
              </div>
            </div>
          )}

          {(reservation.paymentMethod === 'transferencia' || 
            (reservation.advanceAmount > 0 && reservation.advancePaymentMethod === 'transferencia')) && (
            <div className="p-4 border border-blue-200 rounded bg-blue-50 text-sm text-blue-800">
              <p className="font-semibold mb-1">Información Bancaria:</p>
              <p>Banco: BBVA</p>
              <p>Titular: TransRoute S.A. de C.V.</p>
              <p>CLABE: 0123 4567 8901 2345 67</p>
              <p className="mt-1">Verifica tu pago: 555-123-4567</p>
            </div>
          )}
          
          <div className="text-center text-xs text-gray-500 mt-6">
            <p>TransRoute © {new Date().getFullYear()}</p>
            <p className="mt-1">Presente este comprobante al abordar el vehículo</p>
            {!isPaid && (
              <p className="text-amber-600 font-medium mt-1">
                IMPORTANTE: Complete el pago antes de abordar
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmación para marcar como pagado */}
      <Dialog open={isMarkPaidModalOpen} onOpenChange={setIsMarkPaidModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea marcar esta reservación como pagada?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert>
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Esta acción confirmará que el pago total de {formatPrice(reservation.totalAmount)} ha sido recibido.
                No se puede deshacer.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMarkPaidModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? (
                <>
                  <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Confirmar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}