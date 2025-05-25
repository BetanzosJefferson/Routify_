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
import { useState } from "react";
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
  paymentMethod: string | null;
  details: any;
}

export function CashboxPage() {
  const [activeTab, setActiveTab] = useState("all");
  
  // Consultar transacciones
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['/api/transactions'],
    retry: 1,
  });

  // Filtrar transacciones por tipo
  const filteredTransactions = transactions?.filter((transaction: Transaction) => {
    if (activeTab === "all") return true;
    return transaction.type === activeTab;
  }) || [];

  // Log para debugging
  console.log("Transacciones recibidas:", transactions);

  // Calcular totales
  const getTotalAmount = (type: string | null = null) => {
    if (!transactions) return 0;
    
    const amount = transactions
      .filter((t: Transaction) => type ? t.type === type : true)
      .reduce((sum: number, transaction: Transaction) => {
        // Asegurar que amount es un número
        const transactionAmount = typeof transaction.amount === 'number' 
          ? transaction.amount 
          : parseFloat(String(transaction.amount)) || 0;
        
        return sum + transactionAmount;
      }, 0);
    
    return amount;
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
                              {transaction.type === "reservation" 
                                ? `Reservación #${transaction.details?.reservationId || "N/A"}` 
                                : `Paquete #${transaction.details?.packageId || "N/A"}`}
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