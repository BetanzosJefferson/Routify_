import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, InfoIcon, Users, DollarSign } from "lucide-react";

interface Transaction {
  id: number;
  user_id: number;
  companyId: string;
  detalles: {
    type: string;
    details: {
      id: number;
      monto: number;
      pasajeros?: string;
      origen?: string;
      destino?: string;
      metodoPago?: string;
      sender?: string;
      recipient?: string;
      notas?: string;
    };
  };
  createdAt: string;
}

export function UserCashBoxesPage() {
  const [userTransactions, setUserTransactions] = useState<{[key: number]: Transaction[]}>({});
  const [userTotals, setUserTotals] = useState<{[key: number]: number}>({});

  // Consulta para obtener las transacciones de otros usuarios
  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/user-cash-boxes"],
    queryFn: async () => {
      const response = await fetch("/api/transactions/user-cash-boxes", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Error al cargar las transacciones");
      }
      return response.json() as Promise<Transaction[]>;
    },
    staleTime: 30000,
  });

  // Agrupar transacciones por usuario y calcular totales
  useEffect(() => {
    if (transactions && Array.isArray(transactions)) {
      const grouped: {[key: number]: Transaction[]} = {};
      const totals: {[key: number]: number} = {};

      transactions.forEach((transaction) => {
        const userId = transaction.user_id;
        if (!grouped[userId]) {
          grouped[userId] = [];
          totals[userId] = 0;
        }
        grouped[userId].push(transaction);
        
        // Sumar el monto de la transacción
        const amount = transaction.detalles?.details?.monto || 0;
        totals[userId] += amount;
      });

      setUserTransactions(grouped);
      setUserTotals(totals);
    }
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando cajas de usuarios...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Error al cargar las transacciones de las cajas de usuarios. Por favor, intenta de nuevo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const userIds = Object.keys(userTransactions).map(Number);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Cajas de usuarios</h1>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{userIds.length} usuarios con transacciones</span>
        </div>
      </div>

      {userIds.length === 0 ? (
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            No se encontraron transacciones de otros usuarios en tu compañía.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6">
          {/* Resumen general */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Resumen de Cajas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {userIds.map((userId) => (
                  <div key={userId} className="text-center p-4 border rounded-lg">
                    <div className="text-lg font-semibold">Usuario #{userId}</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(userTotals[userId])}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {userTransactions[userId].length} transacciones
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabla detallada por usuario */}
          {userIds.map((userId) => (
            <Card key={userId}>
              <CardHeader>
                <CardTitle>
                  Transacciones del Usuario #{userId}
                  <Badge variant="outline" className="ml-2">
                    {userTransactions[userId].length} transacciones
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalles</TableHead>
                      <TableHead>Origen/Destino</TableHead>
                      <TableHead>Método de Pago</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userTransactions[userId].map((transaction) => {
                      const details = transaction.detalles?.details || {};
                      const type = transaction.detalles?.type || 'Desconocido';
                      
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            #{details.id || transaction.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant={type === 'reservation' ? 'default' : 'secondary'}>
                              {type === 'reservation' ? 'Reservación' : 'Paquetería'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {type === 'reservation' ? (
                              <div className="text-sm">
                                <div className="font-medium">{details.pasajeros || 'N/A'}</div>
                                {details.notas && (
                                  <div className="text-muted-foreground mt-1">{details.notas}</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm">
                                <div className="font-medium">
                                  {details.sender || 'N/A'} → {details.recipient || 'N/A'}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="font-medium">{details.origen || 'N/A'}</div>
                              <div className="mt-1">{details.destino || 'N/A'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                              {details.metodoPago || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(details.monto || 0)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(transaction.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}