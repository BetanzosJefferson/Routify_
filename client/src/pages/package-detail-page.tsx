import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { PackageTicket, generatePackageTicketPDF } from "@/components/packages/package-ticket";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [qrUrl, setQrUrl] = useState<string | null>(null);
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

  // Manejar la impresión del ticket
  const handlePrintTicket = () => {
    if (packageQuery.data) {
      try {
        // Generar el PDF con dimensiones de ticket térmico
        generatePackageTicketPDF(packageQuery.data, packageQuery.data.companyName || "TransRoute");
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

  return (
    <div className="container py-8">
      <div className="grid gap-6 md:grid-cols-5">
        {/* Panel izquierdo: Detalles del paquete */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader className="bg-primary/5">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">Paquete #{packageData.id}</CardTitle>
                  <CardDescription>
                    Creado el {formatDate(new Date(packageData.createdAt))}
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
            <CardContent className="pt-6">
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Detalles</TabsTrigger>
                  <TabsTrigger value="tracking">Seguimiento</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="space-y-6">
                    {/* Sección de remitente */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2 flex items-center">
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
                    
                    <Separator />
                    
                    {/* Sección de destinatario */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2 flex items-center">
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
                    
                    <Separator />
                    
                    {/* Detalles del viaje */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2 flex items-center">
                        <Truck className="mr-2 h-5 w-5 text-primary" />
                        Detalles del Viaje
                      </h3>
                      <div className="pl-7 space-y-1">
                        <p className="text-sm flex items-center">
                          <span className="font-medium mr-2">Origen:</span> 
                          {packageData.segmentOrigin || packageData.tripOrigin || "No disponible"}
                        </p>
                        <p className="text-sm flex items-center">
                          <span className="font-medium mr-2">Destino:</span> 
                          {packageData.segmentDestination || packageData.tripDestination || "No disponible"}
                        </p>
                        {packageData.tripDate && (
                          <p className="text-sm flex items-center">
                            <Calendar className="mr-2 h-4 w-4" /> 
                            {formatDate(new Date(packageData.tripDate))}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Detalles del paquete */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2 flex items-center">
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
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="tracking">
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="font-medium">Paquete registrado</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(new Date(packageData.createdAt))}
                        </p>
                      </div>
                    </div>
                    
                    <div className="h-12 border-l-2 border-dashed border-gray-300 ml-5"></div>
                    
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full ${packageData.isPaid ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center`}>
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="font-medium">
                          {packageData.isPaid ? 'Pago recibido' : 'Pago pendiente'}
                        </p>
                        {packageData.isPaid && (
                          <p className="text-sm text-muted-foreground">
                            Pagado mediante {packageData.paymentMethod || 'efectivo'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-12 border-l-2 border-dashed border-gray-300 ml-5"></div>
                    
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full ${packageData.deliveryStatus === 'entregado' ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center`}>
                        <Truck className="h-5 w-5 text-white" />
                      </div>
                      <div className="ml-4">
                        <p className="font-medium">
                          {packageData.deliveryStatus === 'entregado' ? 'Paquete entregado' : 'Entrega pendiente'}
                        </p>
                        {packageData.deliveryStatus === 'entregado' && packageData.checkedAt && (
                          <p className="text-sm text-muted-foreground">
                            Entregado el {formatDate(new Date(packageData.checkedAt))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleSharePackage}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
              <Button onClick={handlePrintTicket}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Ticket
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Panel derecho: Vista del ticket y QR */}
        <div className="md:col-span-2">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg">Vista previa del ticket</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pt-6">
                <div className="p-2 border rounded">
                  <PackageTicket 
                    packageData={packageData} 
                    companyName={packageData.companyName || "TransRoute"} 
                  />
                </div>
              </CardContent>
            </Card>
            
            {qrUrl && (
              <Card>
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-lg">Código QR</CardTitle>
                  <CardDescription>
                    Escanea para verificar este paquete
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pt-6">
                  <div className="border p-4 rounded shadow-sm">
                    <img src={qrUrl} alt="QR Code" className="mx-auto" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}