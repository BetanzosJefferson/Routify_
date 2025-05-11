import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate, formatCurrency } from "@/lib/utils";
// Función auxiliar para verificar permisos de acceso a paquetes
function canUserAccessPackage(userRole: string, userCompany: string, packageCompany: string): boolean {
  // El superAdmin siempre tiene acceso
  if (userRole === "superAdmin") return true;
  
  // Los demás roles solo tienen acceso si es de su compañía
  return userCompany === packageCompany;
}

// Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PackageCheck, CreditCard, User, Truck, Clock, Package, PhoneCall, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Página de verificación de paquetes (accesible por QR)
export default function PackageVerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const packageId = parseInt(id || "0");

  // Verificar que el ID sea válido
  useEffect(() => {
    if (!id || isNaN(packageId) || packageId <= 0) {
      toast({
        title: "Error",
        description: "ID de paquete inválido",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [id, packageId, navigate, toast]);

  // Obtener la información del paquete
  const packageQuery = useQuery({
    queryKey: ["/api/packages/verify", packageId],
    queryFn: () => apiRequest("GET", `/api/packages/${packageId}/verify`).then(res => res.json()),
    enabled: packageId > 0, // Habilitamos sin necesidad de autenticación para ver información básica
  });

  // Mutación para marcar como pagado
  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/packages/${packageId}/mark-paid`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Paquete marcado como pagado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/packages/verify", packageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo marcar el paquete como pagado",
        variant: "destructive",
      });
    }
  });

  // Mutación para marcar como entregado
  const markAsDeliveredMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/packages/${packageId}/mark-delivered`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Paquete marcado como entregado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/packages/verify", packageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo marcar el paquete como entregado",
        variant: "destructive",
      });
    }
  });

  // Determinar si el usuario puede marcar el paquete
  const canMark = user && packageQuery.data && canUserAccessPackage(
    user.role || '',
    user.company || '',
    packageQuery.data.companyId || ''
  );

  if (packageQuery.isLoading) {
    return (
      <div className="container py-8">
        <Card className="max-w-md mx-auto shadow-md">
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (packageQuery.error || !packageQuery.data) {
    return (
      <div className="container py-8">
        <Card className="max-w-md mx-auto shadow-md">
          <CardHeader>
            <CardTitle>Error al cargar el paquete</CardTitle>
            <CardDescription>
              No se pudo obtener la información del paquete. Por favor, inténtelo de nuevo.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const packageData = packageQuery.data;

  return (
    <div className="container py-8">
      <Card className="max-w-md mx-auto shadow-md">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">Paquete #{packageData.id}</CardTitle>
            <Badge variant={packageData.isPaid ? "default" : "destructive"}>
              {packageData.isPaid ? "Pagado" : "Pendiente de pago"}
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDate(new Date(packageData.createdAt))}
          </CardDescription>
          <Separator className="mt-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información de ruta */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Ruta
            </h3>
            <div className="pl-7 space-y-1 text-sm">
              <p><span className="font-medium">Origen:</span> {packageData.segmentOrigin || packageData.tripOrigin || "No especificado"}</p>
              <p><span className="font-medium">Destino:</span> {packageData.segmentDestination || packageData.tripDestination || "No especificado"}</p>
            </div>
          </div>

          {/* Información del remitente */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Remitente
            </h3>
            <div className="pl-7 space-y-1 text-sm">
              <p>{packageData.senderName} {packageData.senderLastName}</p>
              <p className="flex items-center gap-1">
                <PhoneCall className="h-3 w-3" />
                {packageData.senderPhone}
              </p>
            </div>
          </div>

          {/* Información del destinatario */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Destinatario
            </h3>
            <div className="pl-7 space-y-1 text-sm">
              <p>{packageData.recipientName} {packageData.recipientLastName}</p>
              <p className="flex items-center gap-1">
                <PhoneCall className="h-3 w-3" />
                {packageData.recipientPhone}
              </p>
            </div>
          </div>

          {/* Detalles del paquete */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Detalles del Paquete
            </h3>
            <div className="pl-7 space-y-2 text-sm">
              <p>{packageData.packageDescription}</p>
              <p className="font-medium">Precio: {formatCurrency(packageData.price)}</p>
              {packageData.usesSeats && (
                <p>Ocupa {packageData.seatsQuantity} {packageData.seatsQuantity === 1 ? 'asiento' : 'asientos'}</p>
              )}
              <div className="flex gap-2 flex-wrap mt-2">
                <Badge variant={packageData.isPaid ? "default" : "outline"} className="flex gap-1 items-center">
                  <CreditCard className="h-3 w-3" />
                  {packageData.isPaid 
                    ? `Pagado (${packageData.paymentMethod || 'efectivo'})` 
                    : 'Pendiente de pago'}
                </Badge>
                <Badge variant={packageData.deliveryStatus === 'entregado' ? "default" : "outline"} className="flex gap-1 items-center">
                  <Truck className="h-3 w-3" />
                  {packageData.deliveryStatus === 'entregado' 
                    ? 'Entregado' 
                    : 'Pendiente de entrega'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Información de la empresa */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Empresa: {packageData.companyName || "No especificada"}</p>
            <p>TransRoute - Sistema de paquetería</p>
          </div>
        </CardContent>

        {/* Botones de acción (solo para usuarios autorizados) */}
        {canMark && (
          <CardFooter className="flex flex-col gap-3">
            {!packageData.isPaid && (
              <Button 
                className="w-full" 
                onClick={() => markAsPaidMutation.mutate()}
                disabled={markAsPaidMutation.isPending}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Marcar como pagado
              </Button>
            )}
            
            {packageData.deliveryStatus !== 'entregado' && (
              <Button 
                className="w-full" 
                onClick={() => markAsDeliveredMutation.mutate()}
                disabled={markAsDeliveredMutation.isPending}
                variant={packageData.isPaid ? "default" : "outline"}
              >
                <PackageCheck className="mr-2 h-4 w-4" />
                Marcar como entregado
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}