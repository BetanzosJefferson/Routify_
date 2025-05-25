import { useState, useEffect } from "react";
import { DefaultLayout } from "@/components/layout/default-layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { es } from "date-fns/locale";
import { 
  CalendarIcon, 
  Search, 
  UserIcon, 
  Package2Icon, 
  RefreshCcwIcon,
  LandmarkIcon
} from "lucide-react";

// Definición de tipos para las transacciones
interface TransactionBase {
  id: number;
  createdAt: string;
  updatedAt: string;
  detalles: {
    type: string;
    companyId: string;
    metodoPago: string;
    monto: number;
    [key: string]: any;
  };
  usuario_id: number;
}

export function CashboxPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("todas");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  // Consulta para obtener transacciones
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/transactions'],
    retry: 1,
    staleTime: 30000,
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las transacciones. Intente nuevamente."
      });
    }
  });

  // Filtrar transacciones por tipo
  const getFilteredTransactions = () => {
    if (!data?.transactions) return [];
    
    const transactions = data.transactions as TransactionBase[];
    
    // Filtro por fecha si está seleccionada
    let filtered = dateFilter 
      ? transactions.filter(t => {
          const transDate = new Date(t.createdAt).setHours(0, 0, 0, 0);
          const filterDate = new Date(dateFilter).setHours(0, 0, 0, 0);
          return transDate === filterDate;
        })
      : transactions;
    
    // Filtro por tipo de transacción según la pestaña activa
    if (activeTab === "reservaciones") {
      return filtered.filter(t => t.detalles.type === "reservation");
    } else if (activeTab === "paquetes") {
      return filtered.filter(t => t.detalles.type === "package");
    }
    
    return filtered;
  };

  const handleClearDateFilter = () => {
    setDateFilter(undefined);
  };

  // Formatear cantidad a moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN' 
    }).format(amount);
  };

  // Obtener detalles según el tipo de transacción
  const getTransactionDetails = (transaction: TransactionBase) => {
    const { detalles } = transaction;
    
    if (detalles.type === "reservation") {
      return (
        <>
          <div className="font-medium">Reservación #{detalles.id}</div>
          <div className="text-sm text-gray-500">
            {detalles.origen} → {detalles.destino}
          </div>
          <div className="text-sm">
            {detalles.pasajeros ? `${detalles.pasajeros.length} pasajeros` : ''}
          </div>
          {detalles.contacto && (
            <div className="text-xs text-gray-500">
              {detalles.contacto.email || ''} {detalles.contacto.telefono ? `· ${detalles.contacto.telefono}` : ''}
            </div>
          )}
        </>
      );
    } else if (detalles.type === "package") {
      return (
        <>
          <div className="font-medium">Paquete #{detalles.id}</div>
          <div className="text-sm text-gray-500">
            {detalles.origen} → {detalles.destino}
          </div>
          <div className="text-sm">
            {detalles.descripcion && detalles.descripcion.substring(0, 50)}
            {detalles.descripcion && detalles.descripcion.length > 50 ? '...' : ''}
          </div>
          <div className="text-xs text-gray-500">
            Remitente: {detalles.remitente?.nombre || 'No especificado'}
            {detalles.destinatario?.nombre ? ` · Destinatario: ${detalles.destinatario.nombre}` : ''}
          </div>
        </>
      );
    }
    
    return <div className="text-sm text-gray-500">Detalles no disponibles</div>;
  };

  // Calcular totales para cada tipo de transacción
  const calculateTotals = () => {
    if (!data?.transactions) return { total: 0, reservations: 0, packages: 0 };
    
    const transactions = data.transactions as TransactionBase[];
    
    const reservationTotal = transactions
      .filter(t => t.detalles.type === "reservation")
      .reduce((sum, t) => sum + (t.detalles.monto || 0), 0);
    
    const packageTotal = transactions
      .filter(t => t.detalles.type === "package")
      .reduce((sum, t) => sum + (t.detalles.monto || 0), 0);
    
    return {
      total: reservationTotal + packageTotal,
      reservations: reservationTotal,
      packages: packageTotal
    };
  };

  const totals = calculateTotals();
  const filteredTransactions = getFilteredTransactions();

  return (
    <DefaultLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Caja</h1>
          <Button 
            variant="outline" 
            className="flex items-center gap-2" 
            onClick={() => refetch()}
          >
            <RefreshCcwIcon className="h-4 w-4" />
            Actualizar
          </Button>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total General</CardTitle>
              <CardDescription>Suma de todas las transacciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary flex items-center">
                <LandmarkIcon className="mr-2 h-5 w-5" />
                {formatCurrency(totals.total)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Reservaciones</CardTitle>
              <CardDescription>Ingresos por reservaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center">
                <UserIcon className="mr-2 h-5 w-5" />
                {formatCurrency(totals.reservations)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Paqueterías</CardTitle>
              <CardDescription>Ingresos por paqueterías</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 flex items-center">
                <Package2Icon className="mr-2 h-5 w-5" />
                {formatCurrency(totals.packages)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtro de fecha */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Label htmlFor="date-filter">Filtrar por fecha</Label>
            <div className="flex mt-1">
              <DatePicker
                date={dateFilter}
                setDate={setDateFilter}
                locale={es}
                className="w-full"
              />
              {dateFilter && (
                <Button 
                  variant="ghost" 
                  className="ml-2" 
                  onClick={handleClearDateFilter}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Pestañas para filtrar por tipo */}
        <Tabs 
          defaultValue="todas" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="mb-6"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="reservaciones">Reservaciones</TabsTrigger>
            <TabsTrigger value="paquetes">Paqueterías</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tabla de transacciones */}
        <Card>
          <CardHeader>
            <CardTitle>Transacciones</CardTitle>
            <CardDescription>
              {dateFilter ? (
                <span>Mostrando transacciones del {format(dateFilter, 'dd/MM/yyyy')}</span>
              ) : (
                <span>Mostrando todas las transacciones</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : isError ? (
              <div className="text-center py-8 text-red-500">
                Error al cargar las transacciones. Intente nuevamente.
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay transacciones disponibles para mostrar.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Método de pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {transaction.detalles.type === "reservation" ? (
                            <div className="flex items-center">
                              <UserIcon className="mr-2 h-4 w-4 text-green-600" />
                              {transaction.id}
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Package2Icon className="mr-2 h-4 w-4 text-blue-600" />
                              {transaction.id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getTransactionDetails(transaction)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(transaction.createdAt), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {transaction.detalles.metodoPago || 'No especificado'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.detalles.monto || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DefaultLayout>
  );
}