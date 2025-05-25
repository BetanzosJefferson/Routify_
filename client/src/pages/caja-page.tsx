import { DefaultLayout } from "@/components/layout/default-layout";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from "react";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Definir tipos para las transacciones
interface Transaction {
  id: number;
  type: string;
  amount: number;
  createdAt: string;
  updatedAt?: string;
  paymentMethod: string | null;
  details: Record<string, any>;
}

export function CashboxPage() {
  const [activeTab, setActiveTab] = useState("all");
  
  // Consultar transacciones desde la API
  const { data: transactions = [], isLoading, isError, error } = useQuery({
    queryKey: ['/api/transactions'],
    retry: 3,
    refetchOnWindowFocus: false,
    staleTime: 30000
  });
  
  // Debugging
  useEffect(() => {
    console.log("Estado de la consulta:", { isLoading, isError, errorMessage: error });
    console.log("Datos de transacciones:", transactions);
  }, [transactions, isLoading, isError, error]);

  // Filtrar transacciones por tipo y añadir validación adicional
  const filteredTransactions = Array.isArray(transactions) ? transactions.filter((transaction: Transaction) => {
    // Verificar que la transacción existe y tiene los campos necesarios
    if (!transaction) return false;
    
    console.log("Verificando transacción:", transaction);
    
    // Si se seleccionaron todas las transacciones
    if (activeTab === "all") return true;
    
    // Verificar si la transacción tiene un tipo
    if (!transaction.type) {
      console.log("Transacción sin tipo:", transaction.id);
      return false;
    }
    
    return transaction.type === activeTab;
  }) : [];
  
  // Log más detallado para debugging
  console.log(`Transacciones filtradas (${filteredTransactions.length}):`, 
    filteredTransactions.length > 0 ? filteredTransactions.slice(0, 2) : []);

  // Log para debugging
  console.log("Transacciones recibidas:", transactions);

  // Calcular totales
  const getTotalAmount = (type: string | null = null) => {
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) return 0;
    
    try {
      const amount = transactions
        .filter((t: Transaction) => {
          if (!t) return false;
          if (type) return t.type === type;
          return true;
        })
        .reduce((sum: number, transaction: Transaction) => {
          if (!transaction) return sum;
          
          // Asegurar que amount es un número
          const transactionAmount = typeof transaction.amount === 'number' 
            ? transaction.amount 
            : parseFloat(String(transaction.amount)) || 0;
          
          return sum + transactionAmount;
        }, 0);
      
      return amount;
    } catch (error) {
      console.error("Error al calcular el total:", error);
      return 0;
    }
  };

  // Renderizar fecha en formato legible
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: es });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <DefaultLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Caja</h1>
        
        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Transacciones</CardTitle>
              <CardDescription>Monto total de todas las transacciones</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  formatCurrency(getTotalAmount())
                )}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Reservaciones</CardTitle>
              <CardDescription>Total por reservaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  formatCurrency(getTotalAmount("reservation"))
                )}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Paqueterías</CardTitle>
              <CardDescription>Total por paqueterías</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  formatCurrency(getTotalAmount("package"))
                )}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Pestañas y tabla de transacciones */}
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="reservation">Reservaciones</TabsTrigger>
              <TabsTrigger value="package">Paqueterías</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value={activeTab} className="mt-0">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredTransactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Método de Pago</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Detalles</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((transaction: Transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>{transaction.id}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.type === "reservation" 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-blue-100 text-blue-800"
                              }`}>
                                {transaction.type === "reservation" ? "Reservación" : "Paquetería"}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>{transaction.paymentMethod || "No especificado"}</TableCell>
                            <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {(() => {
                                if (!transaction.details) return "Sin detalles";
                                
                                if (transaction.type === "reservation") {
                                  const reservationId = transaction.details.reservationId || 
                                    (transaction.details.details?.id) || 
                                    "N/A";
                                  return `Reservación #${reservationId}`;
                                } else if (transaction.type === "package") {
                                  const packageId = transaction.details.packageId || 
                                    (transaction.details.details?.id) || 
                                    "N/A";
                                  return `Paquete #${packageId}`;
                                } else {
                                  return "Otro tipo de transacción";
                                }
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    No hay transacciones disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DefaultLayout>
  );
}