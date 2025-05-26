import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users, DollarSign, CreditCard, Calendar, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: number;
  user_id: number;
  details: {
    type: string;
    details: {
      id: number;
      monto: number;
      metodoPago: string;
      pasajeros?: string;
      origen?: string;
      destino?: string;
      remitente?: string;
      destinatario?: string;
      companyId: string;
      dateCreated: string;
    };
  };
  createdAt: string;
  companyId: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    company: string;
    profilePicture?: string;
    companyId: string;
    commissionPercentage: number;
  };
}

interface UserCashBoxData {
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  userCompany: string;
  userProfilePicture?: string;
  transactions: Transaction[];
  totalCash: number;
  totalTransfer: number;
  totalAmount: number;
  transactionCount: number;
}

export function UserCashBoxesPage() {
  const { toast } = useToast();
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [showAmounts, setShowAmounts] = useState(true);

  // Consultar transacciones de otros usuarios
  const { data: transactions, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/transactions/user-cash-boxes"],
    staleTime: 60000, // 1 minuto
    gcTime: 300000, // 5 minutos en caché
    queryFn: async () => {
      console.log("[UserCashBoxes] Consultando transacciones de otros usuarios...");
      const response = await fetch("/api/transactions/user-cash-boxes", {
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[UserCashBoxes] Error en la consulta:", response.status, errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as Transaction[];
      console.log("[UserCashBoxes] Transacciones obtenidas:", data.length);
      return data;
    },
    retry: (failureCount, error) => {
      console.log("[UserCashBoxes] Reintento", failureCount, error);
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Procesar datos para agrupar por usuario
  const userCashBoxes: UserCashBoxData[] = React.useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) return [];

    const userGroups = new Map<number, UserCashBoxData>();

    transactions.forEach((transaction) => {
      const userId = transaction.user_id;
      const amount = transaction.detalles?.details?.monto || 0;
      const paymentMethod = transaction.detalles?.details?.metodoPago || "efectivo";
      
      if (!userGroups.has(userId)) {
        userGroups.set(userId, {
          userId,
          userName: `Usuario ${userId}`, // Por ahora usamos ID, después podemos obtener nombres reales
          transactions: [],
          totalCash: 0,
          totalTransfer: 0,
          totalAmount: 0,
          transactionCount: 0,
        });
      }

      const userGroup = userGroups.get(userId)!;
      userGroup.transactions.push(transaction);
      userGroup.transactionCount++;
      userGroup.totalAmount += amount;

      if (paymentMethod === "efectivo") {
        userGroup.totalCash += amount;
      } else {
        userGroup.totalTransfer += amount;
      }
    });

    return Array.from(userGroups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions]);

  const toggleUserExpansion = (userId: number) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    if (!showAmounts) return "****";
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Actualizando datos",
      description: "Consultando transacciones más recientes...",
    });
  };

  const toggleAmountVisibility = () => {
    setShowAmounts(!showAmounts);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
          <p className="text-muted-foreground">
            Gestión de cajas individuales por usuario
          </p>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Cargando datos de cajas de usuarios...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
          <p className="text-muted-foreground">
            Gestión de cajas individuales por usuario
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar datos</AlertTitle>
          <AlertDescription>
            No se pudieron cargar los datos de las cajas de usuarios. Intenta recargar la página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
          <p className="text-muted-foreground">
            Gestión de cajas individuales por usuario
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAmountVisibility}
            className="flex items-center space-x-2"
          >
            {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showAmounts ? "Ocultar montos" : "Mostrar montos"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Resumen general */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCashBoxes.length}</div>
            <p className="text-xs text-muted-foreground">
              {userCashBoxes.length === 1 ? 'usuario activo' : 'usuarios activos'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Efectivo</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(userCashBoxes.reduce((sum, user) => sum + user.totalCash, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total en efectivo
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transferencias</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(userCashBoxes.reduce((sum, user) => sum + user.totalTransfer, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total en transferencias
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(userCashBoxes.reduce((sum, user) => sum + user.totalAmount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {userCashBoxes.reduce((sum, user) => sum + user.transactionCount, 0)} transacciones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de usuarios y sus cajas */}
      <Card>
        <CardHeader>
          <CardTitle>Cajas por Usuario</CardTitle>
          <CardDescription>
            Detalle de transacciones y balances por cada usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userCashBoxes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin datos</AlertTitle>
              <AlertDescription>
                No se encontraron transacciones de otros usuarios en tu compañía.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {userCashBoxes.map((userBox) => (
                <Collapsible key={userBox.userId}>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger 
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50"
                      onClick={() => toggleUserExpansion(userBox.userId)}
                    >
                      <div className="flex items-center space-x-4">
                        {expandedUsers.has(userBox.userId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="text-left">
                          <h3 className="font-semibold">{userBox.userName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {userBox.userRole} • {userBox.userEmail}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {userBox.transactionCount} transacciones
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(userBox.totalAmount)}</div>
                          <div className="text-sm text-muted-foreground">
                            Efectivo: {formatCurrency(userBox.totalCash)} | 
                            Transferencia: {formatCurrency(userBox.totalTransfer)}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border-t p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Detalles</TableHead>
                              <TableHead>Método Pago</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userBox.transactions.map((transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell className="text-sm">
                                  {formatDate(transaction.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={transaction.detalles.type === 'reservation' ? 'default' : 'secondary'}>
                                    {transaction.detalles.type === 'reservation' ? 'Reservación' : 'Paquetería'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {transaction.detalles.type === 'reservation' ? (
                                    <div>
                                      <div className="font-medium">{transaction.detalles.details.pasajeros}</div>
                                      <div className="text-muted-foreground">
                                        {transaction.detalles.details.origen} → {transaction.detalles.details.destino}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="font-medium">
                                        {transaction.detalles.details.remitente} → {transaction.detalles.details.destinatario}
                                      </div>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={transaction.detalles.details.metodoPago === 'efectivo' ? 'default' : 'secondary'}>
                                    {transaction.detalles.details.metodoPago}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(transaction.detalles.details.monto)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}