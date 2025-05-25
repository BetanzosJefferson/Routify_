import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DefaultLayout } from "@/components/layout/default-layout";
import { formatCurrency } from "@/lib/utils";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import { useAuth } from "@/lib/auth";

type TabType = "reservations" | "packages";

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
  const [activeTab, setActiveTab] = useState<TabType>("reservations");
  const { user } = useAuth();

  // Verificar que el usuario tiene acceso a esta página
  useEffect(() => {
    if (user && !hasAccessToSection(user.role, "transactions")) {
      window.location.href = "/dashboard";
    }
  }, [user]);

  // Consultar transacciones pendientes del usuario actual
  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/pending"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <DefaultLayout activeTab="transactions">
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-lg">Cargando transacciones...</p>
        </div>
      </DefaultLayout>
    );
  }

  if (error) {
    return (
      <DefaultLayout activeTab="transactions">
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-lg text-red-500">Error al cargar las transacciones</p>
        </div>
      </DefaultLayout>
    );
  }

  // Filtrar transacciones por tipo
  const reservationTransactions = transactions?.filter(
    (transaction: Transaction) => transaction.type === "reservation"
  ) || [];

  const packageTransactions = transactions?.filter(
    (transaction: Transaction) => transaction.type === "package"
  ) || [];

  return (
    <DefaultLayout activeTab="transactions">
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-bold">Transacciones Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="reservations" value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reservations">
                  Reservaciones ({reservationTransactions.length})
                </TabsTrigger>
                <TabsTrigger value="packages">
                  Paqueterías ({packageTransactions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reservations">
                <Card className="border-0 shadow-none">
                  <CardContent className="p-0 pt-6">
                    {reservationTransactions.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-muted-foreground">No hay transacciones pendientes de reservaciones</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Pasajero</TableHead>
                              <TableHead>Ruta</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Método de Pago</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reservationTransactions.map((transaction: Transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>{transaction.id}</TableCell>
                                <TableCell>
                                  {format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  {transaction.details.passengerName || "N/A"}
                                </TableCell>
                                <TableCell>
                                  {transaction.details.route ? (
                                    <div>
                                      <div>{transaction.details.route.origin}</div>
                                      <div className="text-xs text-muted-foreground">a</div>
                                      <div>{transaction.details.route.destination}</div>
                                    </div>
                                  ) : (
                                    "N/A"
                                  )}
                                </TableCell>
                                <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {transaction.paymentMethod || "Efectivo"}
                                  </Badge>
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
                <Card className="border-0 shadow-none">
                  <CardContent className="p-0 pt-6">
                    {packageTransactions.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <p className="text-muted-foreground">No hay transacciones pendientes de paqueterías</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Paquete</TableHead>
                              <TableHead>Origen - Destino</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Método de Pago</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {packageTransactions.map((transaction: Transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>{transaction.id}</TableCell>
                                <TableCell>
                                  {format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  {transaction.details.packageDescription || "Sin descripción"}
                                </TableCell>
                                <TableCell>
                                  {transaction.details.segmentOrigin && transaction.details.segmentDestination ? (
                                    <div>
                                      <div>{transaction.details.segmentOrigin}</div>
                                      <div className="text-xs text-muted-foreground">a</div>
                                      <div>{transaction.details.segmentDestination}</div>
                                    </div>
                                  ) : (
                                    "N/A"
                                  )}
                                </TableCell>
                                <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {transaction.paymentMethod || "Efectivo"}
                                  </Badge>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}