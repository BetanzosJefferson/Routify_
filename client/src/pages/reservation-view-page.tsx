import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ReservationWithDetails, CheckStatus, ChargeStatus } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { CheckIcon, QrCodeIcon, UserIcon, CalendarIcon, MapPinIcon, TruckIcon, UsersIcon, CreditCardIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ReservationViewPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [reservation, setReservation] = useState<ReservationWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  // Verificar si el usuario tiene permisos para gestionar esta reservación
  const canManageReservation = () => {
    if (!user || !reservation) return false;
    
    // Verificar que el usuario pertenezca a la misma compañía que la reservación
    const userCompany = user.companyId || user.company;
    const reservationCompany = reservation.companyId;
    
    // superAdmin o admin pueden gestionar cualquier reservación
    if (user.role === 'superAdmin' || user.role === 'admin') return true;
    
    // Para otros roles, solo si pertenecen a la misma compañía
    return userCompany === reservationCompany;
  };
  
  // Mutación para marcar como verificado
  const markAsCheckedMutation = useMutation({
    mutationFn: async () => {
      if (!reservation) throw new Error("No reservation found");
      
      // Crear un objeto simple con solo los campos que necesitamos actualizar
      const updateData = {
        checkStatus: "checked" as const, // Usar el valor string literal
        checkedAt: new Date().toISOString(), // Convertir a string ISO para evitar problemas
        checkedBy: user?.id || null // ID del usuario actual si está disponible
      };
      
      console.log("Enviando datos de actualización:", updateData);
      
      const response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservation.id}`, 
        updateData
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(`Failed to mark reservation as checked: ${JSON.stringify(errorData)}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setReservation((prev) => prev ? { ...prev, ...data } : null);
      // Mostrar el diálogo de éxito en lugar de un toast
      setShowSuccessDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para marcar como cobrado
  const markAsChargedMutation = useMutation({
    mutationFn: async () => {
      if (!reservation) throw new Error("No reservation found");
      
      // Crear un objeto simple con solo los campos que necesitamos actualizar
      const updateData = {
        chargeStatus: "charged" as const // Usar el valor string literal
      };
      
      console.log("Enviando datos de actualización para cobrado:", updateData);
      
      const response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservation.id}`, 
        updateData
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(`Failed to mark reservation as charged: ${JSON.stringify(errorData)}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setReservation((prev) => prev ? { ...prev, ...data } : null);
      toast({
        title: "Boleto cobrado",
        description: "El boleto ha sido marcado como cobrado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Efecto para verificación automática cuando se carga la reservación
  useEffect(() => {
    // Solo verificar automáticamente si:
    // 1. La reservación existe
    // 2. No está ya verificada
    // 3. El usuario tiene permisos (autenticado y de la misma compañía)
    // 4. Ya se finalizó la carga de autenticación
    if (
      reservation && 
      reservation.checkStatus !== CheckStatus.CHECKED && 
      canManageReservation() && 
      !isAuthLoading && 
      user
    ) {
      console.log("Verificando automáticamente al escanear");
      markAsCheckedMutation.mutate();
    }
  }, [reservation, user, isAuthLoading]);
  
  // Cargar los datos de la reservación
  useEffect(() => {
    const fetchReservation = async () => {
      setLoading(true);
      
      try {
        // Añadimos el parámetro qr=true para indicar que es una visualización por QR
        const response = await apiRequest("GET", `/api/reservations/${id}?qr=true`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Reservación no encontrada");
          } else {
            setError("Error al cargar la reservación");
          }
          return;
        }
        
        const data = await response.json();
        setReservation(data);
      } catch (err) {
        console.error("Error fetching reservation:", err);
        setError("Error al cargar la reservación");
      } finally {
        setLoading(false);
      }
    };
    
    fetchReservation();
  }, [id]);
  
  // Si está cargando
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin mr-2">
          <QrCodeIcon size={24} />
        </div>
        <p>Cargando...</p>
      </div>
    );
  }
  
  // Si hay un error
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-100 text-red-800 rounded-full p-3 mb-4">
          <QrCodeIcon size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Error</h1>
        <p className="text-center text-gray-600 mb-6">{error}</p>
        <Button 
          variant="outline"
          onClick={() => window.location.href = "/"}
        >
          Volver al inicio
        </Button>
      </div>
    );
  }
  
  // Si no hay reservación
  if (!reservation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-amber-100 text-amber-800 rounded-full p-3 mb-4">
          <QrCodeIcon size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Reservación no encontrada</h1>
        <p className="text-center text-gray-600 mb-6">No pudimos encontrar la reservación solicitada</p>
        <Button 
          variant="outline"
          onClick={() => window.location.href = "/"}
        >
          Volver al inicio
        </Button>
      </div>
    );
  }
  
  // Renderizar la página de la reservación
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-700 mb-3">
            <QrCodeIcon size={32} />
          </div>
          <h1 className="text-2xl font-bold">Ticket #{generateReservationId(reservation.id)}</h1>
        </div>
        
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-primary" />
              Información del Pasajero
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Pasajero principal:</span>
                <div className="font-medium">
                  {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                </div>
                {reservation.passengers.length > 1 && (
                  <div className="text-sm mt-1">
                    + {reservation.passengers.length - 1} pasajeros adicionales
                  </div>
                )}
              </div>
              <div>
                <span className="text-sm text-gray-500">Email:</span>
                <div>{reservation.email}</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Teléfono:</span>
                <div>{reservation.phone}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <TruckIcon className="w-5 h-5 mr-2 text-primary" />
              Información del Viaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Ruta:</span>
                <div className="font-medium">{reservation.trip.route.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Origen:</span>
                  <div>{reservation.trip.segmentOrigin || reservation.trip.route.origin}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Destino:</span>
                  <div>{reservation.trip.segmentDestination || reservation.trip.route.destination}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Fecha:</span>
                  <div>{formatDate(reservation.trip.departureDate)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Hora:</span>
                  <div>{reservation.trip.departureTime}</div>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Pasajeros:</span>
                <div className="flex items-center">
                  <UsersIcon className="w-4 h-4 mr-1 text-gray-500" />
                  {reservation.passengers.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <CreditCardIcon className="w-5 h-5 mr-2 text-primary" />
              Información de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Total:</span>
                <div className="text-lg font-bold">{formatPrice(reservation.totalAmount)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Método de Pago:</span>
                  <div>{reservation.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Estado de Pago:</span>
                  <Badge
                    variant="outline"
                    className={
                      reservation.chargeStatus === ChargeStatus.CHARGED ? 
                        "bg-green-100 text-green-800 border-green-200" : 
                      reservation.chargeStatus === ChargeStatus.CANCELLED ? 
                        "bg-red-100 text-red-800 border-red-200" : 
                        "bg-amber-100 text-amber-800 border-amber-200"
                    }
                  >
                    {reservation.chargeStatus === ChargeStatus.CHARGED ? "Cobrado" : 
                     reservation.chargeStatus === ChargeStatus.CANCELLED ? "Cancelado" : "Pendiente"}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Estado de Verificación:</span>
                <Badge
                  variant="outline"
                  className={reservation.checkStatus === CheckStatus.CHECKED ? 
                    "bg-blue-100 text-blue-800 border-blue-200 mt-1" : 
                    "bg-amber-50 text-amber-700 border-amber-200 mt-1"}
                >
                  {reservation.checkStatus === CheckStatus.CHECKED ? "Verificado" : "No verificado"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Solo mostrar los botones si el usuario tiene permisos */}
        {canManageReservation() && (
          <div className="flex space-x-3">
            {reservation.checkStatus !== CheckStatus.CHECKED && (
              <Button 
                className="flex-1"
                onClick={() => markAsCheckedMutation.mutate()}
                disabled={markAsCheckedMutation.isPending}
              >
                <CheckIcon className="w-4 h-4 mr-2" />
                {markAsCheckedMutation.isPending ? "Verificando..." : "Verificar Boleto"}
              </Button>
            )}
            
            {reservation.chargeStatus !== ChargeStatus.CHARGED && (
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => markAsChargedMutation.mutate()}
                disabled={markAsChargedMutation.isPending}
              >
                <CreditCardIcon className="w-4 h-4 mr-2" />
                {markAsChargedMutation.isPending ? "Procesando..." : "Marcar como Cobrado"}
              </Button>
            )}
          </div>
        )}
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Código de Reservación: #{generateReservationId(reservation.id)}</p>
        </div>
      </div>
      
      {/* Diálogo de confirmación para verificación exitosa */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckIcon className="h-6 w-6 text-green-600" />
              ¡Boleto verificado correctamente!
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center text-center">
            <div className="bg-green-100 text-green-800 rounded-full p-4 mb-4">
              <CheckIcon className="h-10 w-10" />
            </div>
            <p className="text-lg font-medium mb-2">Verificación exitosa</p>
            <p className="text-gray-500">
              El boleto ha sido marcado como verificado para el pasajero {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => setShowSuccessDialog(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}