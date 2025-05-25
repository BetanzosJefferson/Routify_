import { DefaultLayout } from "@/components/layout/default-layout";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, CreditCard, Calendar, User, MapPin, Info } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos para las transacciones
interface Transaccion {
  id: number;
  detalles: any; // Puede ser de tipo reservación o paquetería
  usuario_id: number;
  id_corte?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Formatear moneda en pesos mexicanos
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

// Componente para mostrar detalles de reservación
function ReservationDetails({ details }: { details: any }) {
  // Extraer los detalles de la estructura anidada si es necesario
  const reservationDetails = details.details || details;
  const contactInfo = reservationDetails.contacto || {};
  const contactName = contactInfo.nombre || contactInfo.email || "No disponible";
  
  // Intentar obtener el monto de la transacción
  const monto = reservationDetails.monto || details.amount || 0;
  const amount = typeof monto === 'string' ? parseInt(monto, 10) : monto;
  
  // Extraer pasajeros si están disponibles
  const pasajeros = reservationDetails.pasajeros || "";
  const passengerCount = pasajeros ? pasajeros.split(',').length : 0;
  
  // Información de origen y destino
  const origin = reservationDetails.origen || details.origin || "";
  const destination = reservationDetails.destino || details.destination || "";
  
  // Método de pago
  const paymentMethod = reservationDetails.metodoPago || details.paymentMethod || "";
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <span className="font-medium">{contactName}</span>
      </div>
      
      {passengerCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{passengerCount} pasajeros</Badge>
        </div>
      )}
      
      {origin && destination && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span>{origin} → {destination}</span>
        </div>
      )}
      
      {paymentMethod && (
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <span>Pago: {paymentMethod}</span>
        </div>
      )}
      
      {amount > 0 && (
        <div className="mt-2">
          <Badge variant="secondary" className="text-lg">
            {formatCurrency(amount)}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Componente para mostrar detalles de paquetería
function PackageDetails({ details }: { details: any }) {
  // Extraer los detalles de la estructura anidada si es necesario
  const packageDetails = details.details || details;
  
  // Intentar obtener información del remitente y destinatario
  const sender = packageDetails.remitente || packageDetails.sender || {};
  const senderName = sender.nombre || sender.name || "No disponible";
  
  const recipient = packageDetails.destinatario || packageDetails.recipient || {};
  const recipientName = recipient.nombre || recipient.name || "No disponible";
  
  // Intentar obtener el monto de la transacción
  const monto = packageDetails.monto || details.amount || 0;
  const amount = typeof monto === 'string' ? parseInt(monto, 10) : monto;
  
  // Información de origen y destino
  const origin = packageDetails.origen || details.origin || "";
  const destination = packageDetails.destino || details.destination || "";
  
  // Descripción y método de pago
  const description = packageDetails.descripcion || packageDetails.description || "";
  const paymentMethod = packageDetails.metodoPago || details.paymentMethod || "";
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <span className="font-medium">
          De: {senderName}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        <span className="font-medium">
          Para: {recipientName}
        </span>
      </div>
      
      {origin && destination && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span>{origin} → {destination}</span>
        </div>
      )}
      
      {description && (
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <span>{description}</span>
        </div>
      )}
      
      {paymentMethod && (
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <span>Pago: {paymentMethod}</span>
        </div>
      )}
      
      {amount > 0 && (
        <div className="mt-2">
          <Badge variant="secondary" className="text-lg">
            {formatCurrency(amount)}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Componente principal de la página de caja
export function CashboxPage() {
  // Estado para el filtro de tipo de transacción
  const [transactionType, setTransactionType] = useState<string | null>(null);
  
  // Consulta para obtener las transacciones
  const { data: transacciones, isLoading, error } = useQuery({
    queryKey: ['/api/transactions/company', transactionType],
    queryFn: async () => {
      const url = transactionType 
        ? `/api/transactions/company?type=${transactionType}` 
        : '/api/transactions/company';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al cargar las transacciones');
      }
      
      return response.json() as Promise<Transaccion[]>;
    }
  });
  
  // Función para cambiar el tipo de transacción
  const handleTabChange = (value: string) => {
    setTransactionType(value === 'all' ? null : value);
  };
  
  // Calcular totales por tipo
  const getTotals = () => {
    if (!transacciones) return { reservations: 0, packages: 0, total: 0 };
    
    const reservations = transacciones.filter(t => t.detalles?.type === 'reservation')
      .reduce((sum, t) => {
        // Intentar obtener el monto de diferentes ubicaciones posibles en la estructura
        const monto = t.detalles?.amount || t.detalles?.details?.monto || 0;
        return sum + (typeof monto === 'string' ? parseInt(monto, 10) : monto);
      }, 0);
    
    const packages = transacciones.filter(t => t.detalles?.type === 'package')
      .reduce((sum, t) => {
        // Intentar obtener el monto de diferentes ubicaciones posibles en la estructura
        const monto = t.detalles?.amount || t.detalles?.details?.monto || 0;
        return sum + (typeof monto === 'string' ? parseInt(monto, 10) : monto);
      }, 0);
    
    return {
      reservations,
      packages,
      total: reservations + packages
    };
  };
  
  const totals = getTotals();
  
  return (
    <DefaultLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Transacciones</h1>
        
        {/* Resumen de totales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Reservaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.reservations)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Paqueterías</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.packages)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs para filtrar por tipo */}
        <Tabs defaultValue="all" onValueChange={handleTabChange} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="reservation">Reservaciones</TabsTrigger>
            <TabsTrigger value="package">Paqueterías</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Estado de carga y errores */}
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Cargando transacciones...</span>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">
              Error al cargar las transacciones. Por favor, intenta de nuevo.
            </p>
          </div>
        )}
        
        {/* Lista de transacciones */}
        {transacciones && transacciones.length === 0 && !isLoading && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No se encontraron transacciones con los filtros seleccionados.
            </p>
          </div>
        )}
        
        {transacciones && transacciones.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {transacciones.map((transaccion) => (
              <Card key={transaccion.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-medium">
                      Transacción #{transaccion.id}
                    </CardTitle>
                    {transaccion.detalles?.type === 'reservation' ? (
                      <Badge>Reservación</Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Package className="h-3 w-3" /> Paquetería
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {format(new Date(transaccion.createdAt), "PPpp", { locale: es })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {transaccion.detalles?.type === 'reservation' ? (
                    <ReservationDetails details={transaccion.detalles} />
                  ) : (
                    <PackageDetails details={transaccion.detalles} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DefaultLayout>
  );
}