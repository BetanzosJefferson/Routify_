import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Tipos para las transacciones
interface TransactionDetails {
  id: number;
  monto: number;
  notas: string | null;
  origen: string;
  tripId: number | string;
  destino: string;
  isSubTrip?: boolean;
  metodoPago: string;
  companyId?: string;
  dateCreated?: string;
}

interface ReservationDetails extends TransactionDetails {
  pasajeros: string;
  contacto: {
    email: string;
    telefono: string;
  };
}

interface PackageDetails extends TransactionDetails {
  remitente: string;
  destinatario: string;
  descripcion: string;
  usaAsientos: boolean;
  asientos: number;
}

interface TransactionDetails {
  id: number;
  monto: number;
  notas: string | null;
  origen: string;
  tripId?: number;
  destino: string;
  isSubTrip?: boolean;
  pasajeros?: string;
  contacto?: {
    email: string;
    telefono: string;
  };
  remitente?: string;
  destinatario?: string;
  descripcion?: string;
  usaAsientos?: boolean;
  asientos?: number;
  metodoPago: string;
  companyId?: string;
  dateCreated?: string;
}

interface Transaction {
  id: number;
  detalles: {
    type: "reservation" | "package" | "reservation-final-payment" | "package-final-payment";
    details: TransactionDetails;
  };
  usuario_id: number;
  id_corte: number | null;
  createdAt: string;
  updatedAt: string;
  companyId?: string;
}

const TransactionBox: React.FC = () => {
  const { toast } = useToast();
  const [reservationTransactions, setReservationTransactions] = useState<Transaction[]>([]);
  const [packageTransactions, setPackageTransactions] = useState<Transaction[]>([]);

  // Consultar las transacciones del usuario actual
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/current"],
    staleTime: 30000, // 30 segundos
  });

  useEffect(() => {
    if (data) {
      // Separar las transacciones por tipo
      const reservations: Transaction[] = [];
      const packages: Transaction[] = [];

      if (Array.isArray(data)) {
        console.log("Transacciones recibidas:", data);
        
        data.forEach((transaction: any) => {
          try {
            // Verificar que la transacción y sus datos son válidos
            if (transaction && transaction.detalles) {
              const transactionType = transaction.detalles.type;
              
              // Incluir también las transacciones de tipo 'reservation-final-payment'
              if (transactionType === "reservation" || transactionType === "reservation-final-payment") {
                reservations.push(transaction as Transaction);
              } else if (transactionType === "package" || transactionType === "package-final-payment") {
                packages.push(transaction as Transaction);
              } else {
                console.warn("Tipo de transacción desconocido:", transactionType, transaction);
              }
            } else {
              console.warn("Transacción sin tipo definido:", transaction);
            }
          } catch (error) {
            console.error("Error al procesar transacción:", error, transaction);
          }
        });
        
        console.log("Transacciones procesadas - Reservaciones:", reservations.length, "Paquetes:", packages.length);
      } else {
        console.error("Los datos recibidos no son un array:", data);
      }

      setReservationTransactions(reservations);
      setPackageTransactions(packages);
    }
  }, [data]);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando transacciones...</span>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Receipt className="mr-2 h-6 w-6" />
          Transacciones en Caja
        </CardTitle>
        <CardDescription>
          Transacciones pendientes que no han sido incluidas en un corte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reservations">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reservations">
              Reservaciones ({reservationTransactions.length})
            </TabsTrigger>
            <TabsTrigger value="packages">
              Paqueterías ({packageTransactions.length})
            </TabsTrigger>
          </TabsList>

          {/* Tabla de Reservaciones */}
          <TabsContent value="reservations">
            <Table>
              <TableCaption>
                {reservationTransactions.length === 0
                  ? "No hay transacciones de reservaciones pendientes"
                  : "Lista de transacciones de reservaciones"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Viaje</TableHead>
                  <TableHead>Origen-Destino</TableHead>
                  <TableHead>Pasajeros</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Compañía</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservationTransactions.map((transaction) => {
                  try {
                    const details = transaction.detalles?.details || {};
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDate(details.dateCreated || transaction.createdAt)}
                        </TableCell>
                        <TableCell>{details.id}</TableCell>
                        <TableCell>
                          {details.tripId || 'N/A'}
                          {details.isSubTrip && (
                            <Badge variant="outline" className="ml-1">
                              Sub
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{details.origen}</div>
                            <div className="mt-1">{details.destino}</div>
                          </div>
                        </TableCell>
                        <TableCell>{details.pasajeros || 'N/A'}</TableCell>
                        <TableCell>{formatCurrency(details.monto || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                            {details.metodoPago || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {details.companyId || transaction.companyId || "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  } catch (error) {
                    console.error("Error al renderizar transacción:", error, transaction);
                    return null;
                  }
                })}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Tabla de Paqueterías */}
          <TabsContent value="packages">
            <Table>
              <TableCaption>
                {packageTransactions.length === 0
                  ? "No hay transacciones de paqueterías pendientes"
                  : "Lista de transacciones de paqueterías"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Origen-Destino</TableHead>
                  <TableHead>Remitente/Destinatario</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Compañía</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packageTransactions.map((transaction) => {
                  try {
                    const details = transaction.detalles?.details || {};
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDate(details.dateCreated || transaction.createdAt)}
                        </TableCell>
                        <TableCell>{details.id}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">{details.origen}</div>
                            <div className="mt-1">{details.destino}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-medium">De: {details.remitente || 'No especificado'}</div>
                            <div className="mt-1">Para: {details.destinatario || 'No especificado'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs max-w-[150px] truncate">
                            {details.descripcion || "Sin descripción"}
                            {details.usaAsientos && (
                              <Badge variant="outline" className="ml-1">
                                {details.asientos} asiento{details.asientos !== 1 && "s"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(details.monto || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                            {details.metodoPago || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {details.companyId || transaction.companyId || "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  } catch (error) {
                    console.error("Error al renderizar transacción de paquete:", error, transaction);
                    return null;
                  }
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TransactionBox;