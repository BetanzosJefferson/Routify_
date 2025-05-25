import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

import { Sidebar } from "../components/layout/sidebar";
import { MobileNav } from "../components/layout/mobile-nav";
import { Topbar } from "../components/layout/topbar";
import { useAuth } from "../hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type TabType = "create-route" | "publish-trip" | "trips";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  paymentMethod: string | null;
  details: Record<string, any>;
  createdAt: string;
  createdBy: number | null;
  cutoffId: number | null;
}

export default function TransactionsPage() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("create-route");
  const { user } = useAuth();

  // Consulta para obtener las transacciones pendientes del usuario actual
  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/pending"],
    enabled: !!user
  });

  // Separar las transacciones por tipo
  const reservationTransactions = transactions?.filter(
    (transaction: Transaction) => transaction.type === "reservation"
  ) || [];

  const packageTransactions = transactions?.filter(
    (transaction: Transaction) => transaction.type === "package"
  ) || [];

  // Función para verificar si el usuario tiene acceso a esta sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return sectionId === "transactions"; // Simplificado para este componente
  };

  // Si el usuario no tiene acceso, mostrar mensaje de acceso denegado
  if (!canAccess("transactions")) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
          <Topbar />
          
          <div className="flex-1 overflow-auto focus:outline-none">
            <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                  No tienes permisos para acceder a esta sección. Contacta al administrador si crees que deberías tener acceso.
                </AlertDescription>
              </Alert>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Función para formatear la fecha
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: es });
    } catch (error) {
      return dateString;
    }
  };

  // Función para formatear el monto en pesos mexicanos
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  // Contenido de carga
  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
          <Topbar />
          
          <div className="flex-1 overflow-auto focus:outline-none">
            <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
              <h1 className="text-2xl font-bold mb-6">Caja</h1>
              
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Cargando transacciones...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Si hay error en la consulta
  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
          <Topbar />
          
          <div className="flex-1 overflow-auto focus:outline-none">
            <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
              <h1 className="text-2xl font-bold mb-6">Caja</h1>
              
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  No se pudieron cargar las transacciones. Por favor, intenta de nuevo más tarde.
                </AlertDescription>
              </Alert>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold mb-6">Caja</h1>
            
            <Tabs defaultValue="reservations" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="reservations">
                  Reservaciones ({reservationTransactions.length})
                </TabsTrigger>
                <TabsTrigger value="packages">
                  Paqueterías ({packageTransactions.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="reservations">
                <Card>
                  <CardHeader>
                    <CardTitle>Transacciones de Reservaciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reservationTransactions.length === 0 ? (
                      <p className="text-muted-foreground">No hay transacciones pendientes de reservaciones.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Método de Pago</TableHead>
                              <TableHead>Detalles</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reservationTransactions.map((transaction: Transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>{transaction.id}</TableCell>
                                <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {transaction.paymentMethod || "Efectivo"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-xs truncate">
                                    {transaction.details?.reservationId && (
                                      <span>Reservación #{transaction.details.reservationId}</span>
                                    )}
                                    {transaction.details?.passengerName && (
                                      <span> - {transaction.details.passengerName}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="packages">
                <Card>
                  <CardHeader>
                    <CardTitle>Transacciones de Paqueterías</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {packageTransactions.length === 0 ? (
                      <p className="text-muted-foreground">No hay transacciones pendientes de paqueterías.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Método de Pago</TableHead>
                              <TableHead>Detalles</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {packageTransactions.map((transaction: Transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>{transaction.id}</TableCell>
                                <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {transaction.paymentMethod || "Efectivo"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-xs truncate">
                                    {transaction.details?.packageId && (
                                      <span>Paquete #{transaction.details.packageId}</span>
                                    )}
                                    {transaction.details?.origin && transaction.details?.destination && (
                                      <span> - {transaction.details.origin} a {transaction.details.destination}</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  );
}