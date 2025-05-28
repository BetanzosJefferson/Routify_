import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { PackageTicket, generatePackageTicketPDF } from "@/components/packages/package-ticket";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  Calendar,
  User,
  Phone,
  Truck,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronsRight,
  Share2,
  Printer,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCode from "qrcode";

export default function PackageDetailPage() {
  const [match, params] = useRoute("/package/:id");
  const { toast } = useToast();
  const { user } = useAuth();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isSameCompany, setIsSameCompany] = useState<boolean>(false);
  const packageId = params?.id ? parseInt(params.id) : 0;

  // Consultar los detalles del paquete desde la API
  const packageQuery = useQuery({
    queryKey: [`/api/public/packages/${packageId}`],
    queryFn: async () => {
      if (!packageId) return null;
      const response = await fetch(`/api/public/packages/${packageId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles del paquete");
      }
      return await response.json();
    },
    enabled: !!packageId,
  });

  // Generar código QR con la URL para verificar el paquete
  React.useEffect(() => {
    if (packageQuery.data) {
      const verificationUrl = `${window.location.origin}/package/${packageId}`;
      QRCode.toDataURL(verificationUrl, { width: 200 })
        .then(url => {
          setQrUrl(url);
        })
        .catch(err => {
          console.error("Error al generar QR:", err);
        });
    }
  }, [packageQuery.data, packageId]);
  
  // Efecto para comprobar si el usuario pertenece a la misma compañía que el paquete
  useEffect(() => {
    if (user && packageQuery.data) {
      // Si el usuario tiene rol superAdmin, siempre tiene acceso
      if (user.role === 'superAdmin') {
        setIsSameCompany(true);
        console.log("¿Coincide la compañía?", true, "(superAdmin)");
        return;
      }
      
      // Si el usuario tiene rol taquilla, tiene acceso a paquetes de todas sus empresas asociadas
      // Como el endpoint /api/taquilla/packages ya filtra por empresas autorizadas,
      // si llegamos a ver este paquete, significa que tenemos acceso
      if (user.role === 'taquilla') {
        setIsSameCompany(true);
        console.log("¿Coincide la compañía?", true, "(rol taquilla con acceso multi-empresa)");
        return;
      }
      
      // Para otros roles, comprobar si el companyId coincide
      // El usuario puede tener la compañía en diferentes formatos:
      // 1. user.companyId - identificador directo de la compañía (formato slug)
      // 2. user.company - nombre de la compañía que podemos convertir a slug
      const userCompanyId = user.companyId || "";
      const userCompanySlug = user.company ? user.company.toLowerCase().replace(/\s+/g, '-') : "";
      
      // Comparación con el companyId del paquete
      // Intentamos todas las posibles coincidencias
      const packageCompanyId = packageQuery.data.companyId || "";
      
      const matchesCompany = 
        // Verificar coincidencia directa por companyId
        (userCompanyId && packageCompanyId && packageCompanyId === userCompanyId) ||
        // Verificar coincidencia por slug de company
        (userCompanySlug && packageCompanyId && packageCompanyId === userCompanySlug) ||
        // Verificar coincidencia por slug con formato típico (company-123)
        (userCompanySlug && packageCompanyId && packageCompanyId.startsWith(userCompanySlug + '-'));
      
      console.log("Datos del paquete:", JSON.stringify(packageQuery.data, null, 2));
      console.log("CompanyId del usuario:", userCompanyId);
      console.log("Company del usuario (slug):", userCompanySlug);
      console.log("CompanyId del paquete:", packageCompanyId);
      console.log("¿Coincide la compañía?", matchesCompany);
      
      setIsSameCompany(matchesCompany);
    } else {
      setIsSameCompany(false);
    }
  }, [user, packageQuery.data]);

  // Manejar la impresión del ticket
  const handlePrintTicket = async () => {
    if (packageQuery.data) {
      try {
        toast({
          title: "Generando ticket",
          description: "Por favor espere mientras se genera el ticket...",
        });
        
        // Generar el PDF con dimensiones de ticket térmico
        await generatePackageTicketPDF(packageQuery.data, packageQuery.data.companyName || "TransRoute");
      } catch (error) {
        console.error("Error al generar el ticket PDF:", error);
        toast({
          title: "Error",
          description: "No se pudo generar el ticket PDF. Intente nuevamente.",
          variant: "destructive",
        });
      }
    }
  };

  // Compartir enlace del paquete
  const handleSharePackage = () => {
    const url = window.location.href;
    
    if (navigator.share) {
      navigator.share({
        title: `Paquete #${packageId}`,
        text: `Detalles del paquete #${packageId}`,
        url: url,
      })
      .catch(error => {
        console.error("Error al compartir:", error);
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: "Enlace copiado",
          description: "El enlace se ha copiado al portapapeles",
        });
      });
    }
  };

  // Estados de carga y error
  if (packageQuery.isLoading) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Separator />
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (packageQuery.isError || !packageQuery.data) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>No se pudieron cargar los detalles del paquete</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-center mb-4">
                El paquete solicitado no existe o no tienes permisos para verlo.
              </p>
              <Link href="/">
                <Button>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const packageData = packageQuery.data;

  // Manejo de marcado como pagado
  const handleMarkAsPaid = async () => {
    try {
      toast({
        title: "Procesando...",
        description: "Marcando paquete como pagado",
      });
      
      console.log(`Enviando petición para marcar como pagado el paquete ${packageId}`);
      
      // No necesitamos enviar el ID del usuario en la petición
      // El servidor lo obtendrá de la sesión autenticada
      const response = await fetch(`/api/public/packages/${packageId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          isPaid: true,
          // Solo enviamos los datos necesarios, el servidor se encargará 
          // de obtener el usuario desde la sesión
        })
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el estado de pago");
      }
      
      // Recargar los datos del paquete
      console.log("Paquete marcado como pagado, recargando datos...");
      await packageQuery.refetch();
      
      toast({
        title: "¡Éxito!",
        description: "El paquete ha sido marcado como pagado",
        variant: "default",
      });
    } catch (error) {
      console.error("Error al marcar como pagado:", error);
      toast({
        title: "Error",
        description: "No se pudo marcar el paquete como pagado",
        variant: "destructive",
      });
    }
  };
  
  // Manejo de marcado como entregado
  const handleMarkAsDelivered = async () => {
    try {
      toast({
        title: "Procesando...",
        description: "Marcando paquete como entregado",
      });
      
      console.log(`Enviando petición para marcar como entregado el paquete ${packageId}`);
      
      // No necesitamos enviar el ID del usuario en la petición
      // El servidor lo obtendrá de la sesión autenticada
      const response = await fetch(`/api/public/packages/${packageId}/mark-delivered`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          deliveryStatus: 'entregado',
          // Solo enviamos los datos necesarios, el servidor se encargará 
          // de obtener el usuario desde la sesión
        })
      });
      
      if (!response.ok) {
        throw new Error("Error al actualizar el estado de entrega");
      }
      
      // Recargar los datos del paquete
      console.log("Paquete marcado como entregado, recargando datos...");
      await packageQuery.refetch();
      
      toast({
        title: "¡Éxito!",
        description: "El paquete ha sido marcado como entregado",
        variant: "default",
      });
    } catch (error) {
      console.error("Error al marcar como entregado:", error);
      toast({
        title: "Error",
        description: "No se pudo marcar el paquete como entregado",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-6">
      <div className="max-w-lg mx-auto">
        <Card className="shadow-md">
          <CardHeader className="bg-primary/5 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Paquete #{packageData.id}</CardTitle>
                <CardDescription>
                  Fecha de envío: {packageData.shippingDate ? formatDate(new Date(packageData.shippingDate)) : 
                    (packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : 
                     formatDate(new Date(packageData.createdAt)))}
                </CardDescription>
              </div>
              <Badge
                className={
                  packageData.deliveryStatus === 'entregado' 
                    ? "bg-green-500 hover:bg-green-600" 
                    : "bg-orange-500 hover:bg-orange-600"
                }
              >
                {packageData.deliveryStatus === 'entregado' ? 'Entregado' : 'Pendiente de entrega'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-5 px-6">
            <div className="space-y-5">
              {/* Sección de remitente */}
              <div className="bg-slate-50 p-3 rounded-md">
                <h3 className="text-md font-semibold mb-2 flex items-center">
                  <User className="mr-2 h-5 w-5 text-primary" />
                  Remitente
                </h3>
                <div className="pl-7 space-y-1">
                  <p className="text-base">
                    {packageData.senderName} {packageData.senderLastName}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Phone className="mr-2 h-4 w-4" /> 
                    {packageData.senderPhone}
                  </p>
                </div>
              </div>
              
              {/* Sección de destinatario */}
              <div className="bg-slate-50 p-3 rounded-md">
                <h3 className="text-md font-semibold mb-2 flex items-center">
                  <User className="mr-2 h-5 w-5 text-primary" />
                  Destinatario
                </h3>
                <div className="pl-7 space-y-1">
                  <p className="text-base">
                    {packageData.recipientName} {packageData.recipientLastName}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Phone className="mr-2 h-4 w-4" /> 
                    {packageData.recipientPhone}
                  </p>
                </div>
              </div>
              
              {/* Detalles del viaje */}
              <div className="bg-slate-50 p-3 rounded-md">
                <h3 className="text-md font-semibold mb-2 flex items-center">
                  <Truck className="mr-2 h-5 w-5 text-primary" />
                  Detalles del Viaje
                </h3>
                <div className="pl-7 space-y-1">
                  <p className="text-sm flex items-center">
                    <span className="font-medium mr-2">Origen:</span> 
                    {packageData.segmentOrigin || "No disponible"}
                  </p>
                  <p className="text-sm flex items-center">
                    <span className="font-medium mr-2">Destino:</span> 
                    {packageData.segmentDestination || "No disponible"}
                  </p>
                  {packageData.tripDate && (
                    <p className="text-sm flex items-center">
                      <Calendar className="mr-2 h-4 w-4" /> 
                      {formatDate(new Date(packageData.tripDate))}
                    </p>
                  )}
                  {packageData.departureTime && (
                    <p className="text-sm flex items-center">
                      <Clock className="mr-2 h-4 w-4" /> 
                      Hora de salida: {packageData.departureTime}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Detalles del paquete */}
              <div className="bg-slate-50 p-3 rounded-md">
                <h3 className="text-md font-semibold mb-2 flex items-center">
                  <Package className="mr-2 h-5 w-5 text-primary" />
                  Descripción del Paquete
                </h3>
                <div className="pl-7 space-y-1">
                  <p className="text-base">
                    {packageData.packageDescription}
                  </p>
                  <p className="text-sm mt-2 flex items-center">
                    <DollarSign className="mr-2 h-4 w-4" /> 
                    <span className="font-medium">Precio:</span> 
                    <span className="ml-1">{formatCurrency(packageData.price)}</span>
                  </p>
                  
                  {packageData.usesSeats && (
                    <p className="text-sm flex items-center">
                      <ChevronsRight className="mr-2 h-4 w-4" /> 
                      <span>
                        Ocupa {packageData.seatsQuantity} {packageData.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                      </span>
                    </p>
                  )}
                  
                  <div className="flex items-center mt-2">
                    <span className="font-medium mr-2">Estado de pago:</span>
                    {packageData.isPaid ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <CheckCircle className="mr-1 h-3 w-3" /> 
                        Pagado {packageData.paymentMethod ? `(${packageData.paymentMethod})` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> 
                        Pendiente de pago
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center mt-2">
                    <span className="font-medium mr-2">Estado de entrega:</span>
                    {packageData.deliveryStatus === 'entregado' ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Truck className="mr-1 h-3 w-3" /> 
                        Entregado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> 
                        Pendiente de entrega
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-wrap gap-3 justify-center pt-2 pb-4">
            {/* Botones para marcado de estado - solo visibles si el usuario está autenticado y pertenece a la misma compañía */}
            {user && isSameCompany && (
              <>
                {!packageData.isPaid && (
                  <Button 
                    variant="default" 
                    className="bg-green-600 hover:bg-green-700 w-full md:w-auto" 
                    onClick={handleMarkAsPaid}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como pagado
                  </Button>
                )}
                
                {packageData.deliveryStatus !== 'entregado' && (
                  <Button 
                    variant="default" 
                    className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto" 
                    onClick={handleMarkAsDelivered}
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Marcar como entregado
                  </Button>
                )}
              </>
            )}
            
            {/* Botón de impresión de ticket (siempre visible) */}
            <Button 
              variant="outline" 
              className="w-full md:w-auto" 
              onClick={handlePrintTicket}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir ticket
            </Button>
            
            {/* Botón para compartir */}
            <Button 
              variant="outline" 
              className="w-full md:w-auto" 
              onClick={handleSharePackage}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Compartir
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}