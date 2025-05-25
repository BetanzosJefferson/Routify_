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

interface Transaction {
  id: number;
  detalles: {
    type: "reservation" | "package";
    details: ReservationDetails | PackageDetails;
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
    console.log("Datos recibidos del endpoint:", data);
    
    if (data) {
      console.log("Tipo de datos recibidos:", typeof data);
      console.log("¿Es un array?", Array.isArray(data));
      console.log("Longitud de los datos:", data.length);
      
      // Separar las transacciones por tipo
      const reservations: Transaction[] = [];
      const packages: Transaction[] = [];

      try {
        if (Array.isArray(data)) {
          data.forEach((transaction: Transaction) => {
            console.log("Procesando transacción:", transaction);
            console.log("Detalles de la transacción:", transaction.detalles);
            
            if (transaction.detalles && transaction.detalles.type === "reservation") {
              reservations.push(transaction);
            } else if (transaction.detalles && transaction.detalles.type === "package") {
              packages.push(transaction);
            } else {
              console.log("Transacción con formato desconocido:", transaction);
            }
          });
        } else {
          console.error("Los datos recibidos no son un array:", data);
        }
      } catch (err) {
        console.error("Error al procesar las transacciones:", err);
      }

      console.log("Transacciones de reservaciones encontradas:", reservations.length);
      console.log("Transacciones de paqueterías encontradas:", packages.length);
      
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

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md">
        <p className="text-destructive font-medium">
          Error al cargar transacciones. Por favor, intenta de nuevo más tarde.
        </p>
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
                  const details = transaction.detalles.details as ReservationDetails;
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {formatDate(details.dateCreated || transaction.createdAt)}
                      </TableCell>
                      <TableCell>{details.id}</TableCell>
                      <TableCell>
                        {details.tripId}
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
                      <TableCell>{details.pasajeros}</TableCell>
                      <TableCell>{formatCurrency(details.monto)}</TableCell>
                      <TableCell>
                        <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                          {details.metodoPago}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {details.companyId || transaction.companyId || "N/A"}
                      </TableCell>
                    </TableRow>
                  );
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
                  const details = transaction.detalles.details as PackageDetails;
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
                          <div className="font-medium">De: {details.remitente}</div>
                          <div className="mt-1">Para: {details.destinatario}</div>
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
                      <TableCell>{formatCurrency(details.monto)}</TableCell>
                      <TableCell>
                        <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                          {details.metodoPago}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {details.companyId || transaction.companyId || "N/A"}
                      </TableCell>
                    </TableRow>
                  );
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