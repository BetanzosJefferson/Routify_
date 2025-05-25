import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Receipt, DollarSign, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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
  usuario_id: number; // Nombre en español que viene del cliente
  user_id: number; // Nombre en inglés que viene de la BD
  id_corte: number | null;
  cutoff_id: number | null; // Nombre en inglés que viene de la BD
  createdAt: string;
  updatedAt: string;
  companyId?: string;
}

const TransactionBox: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reservationTransactions, setReservationTransactions] = useState<Transaction[]>([]);
  const [packageTransactions, setPackageTransactions] = useState<Transaction[]>([]);

  // Consultar las transacciones del usuario actual
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/current"],
    staleTime: 30000, // 30 segundos
    queryFn: async () => {
      const response = await fetch("/api/transactions/current", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  useEffect(() => {
    if (data && user) {
      // Separar las transacciones por tipo
      const reservations: Transaction[] = [];
      const packages: Transaction[] = [];

      if (Array.isArray(data)) {
        console.log("Transacciones recibidas:", data.length);
        
        data.forEach((transaction: any) => {
          try {
            // Verificar que la transacción y sus datos son válidos
            if (transaction && typeof transaction === 'object' && transaction.detalles && typeof transaction.detalles === 'object') {
              // Verificación CRÍTICA: Filtrar por user_id (nombre en inglés que usa la BD)
              // O usuario_id (nombre en español que podría estar en los datos)
              const transactionUserId = transaction.user_id || transaction.usuario_id;
              
              // Solo procesar transacciones del usuario actual
              if (transactionUserId !== user.id) {
                console.log(`Omitiendo transacción ${transaction.id} porque pertenece a otro usuario (${transactionUserId}), usuario actual: ${user.id}`);
                return;
              }
              
              const transactionType = transaction.detalles.type;
              
              // Verificar que detalles.details existe
              if (!transaction.detalles.details) {
                console.warn("La transacción no tiene detalles.details:", transaction);
                return;
              }
              
              // Validar y mostrar todos los tipos de transacciones
              if (transactionType === "reservation" || transactionType === "reservation-final-payment") {
                console.log("Añadiendo transacción de reservación:", transaction.id);
                reservations.push(transaction as Transaction);
              } else if (transactionType === "package" || transactionType === "package-final-payment") {
                console.log("Añadiendo transacción de paquetería:", transaction.id);
                packages.push(transaction as Transaction);
              } else {
                console.warn("Tipo de transacción desconocido:", transactionType, transaction);
              }
            } else {
              console.warn("Transacción inválida o sin tipo definido:", transaction);
            }
          } catch (error) {
            console.error("Error al procesar transacción:", error, transaction);
          }
        });
        
        console.log("Transacciones procesadas - Reservaciones:", reservations.length, "Paquetes:", packages.length);
      } else {
        console.error("Los datos recibidos no son un array:", data);
        toast({
          title: "Error al cargar transacciones",
          description: "El formato de datos recibido no es correcto.",
          variant: "destructive",
        });
      }

      setReservationTransactions(reservations);
      setPackageTransactions(packages);
    }
  }, [data, toast, user]);

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

  // Mostrar mensaje de carga
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando transacciones...</span>
      </div>
    );
  }
  
  // Mostrar mensaje de error
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center p-8 text-red-500">
        <span className="font-bold">Error al cargar transacciones:</span>
        <span className="mt-2">{error instanceof Error ? error.message : "Error desconocido"}</span>
        <button 
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Consulta para obtener historial de cortes de caja
  const { data: cutoffsData, isLoading: isCutoffsLoading } = useQuery({
    queryKey: ["/api/transactions/cutoffs"],
    enabled: true,
  });
  
  // Convertir fecha ISO a formato legible
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calcular totales para mostrar en el resumen
  const calculateTotals = () => {
    let totalIngresos = 0;
    let totalEfectivo = 0;
    let totalTransferencias = 0;

    // Procesar transacciones de reservaciones
    reservationTransactions.forEach(transaction => {
      const details = transaction.detalles?.details || {};
      const monto = details.monto || 0;
      const metodoPago = details.metodoPago || "efectivo";
      
      totalIngresos += monto;
      
      if (metodoPago === "efectivo") {
        totalEfectivo += monto;
      } else if (metodoPago === "transferencia") {
        totalTransferencias += monto;
      }
    });

    // Procesar transacciones de paqueterías
    packageTransactions.forEach(transaction => {
      const details = transaction.detalles?.details || {};
      const monto = details.monto || 0;
      const metodoPago = details.metodoPago || "efectivo";
      
      totalIngresos += monto;
      
      if (metodoPago === "efectivo") {
        totalEfectivo += monto;
      } else if (metodoPago === "transferencia") {
        totalTransferencias += monto;
      }
    });

    return {
      totalIngresos,
      totalEfectivo,
      totalTransferencias,
    };
  };

  const totals = calculateTotals();
  
  // Función para crear un corte de caja
  const queryClient = useQueryClient();
  const [isCreatingCutoff, setIsCreatingCutoff] = useState(false);
  
  const createCutoffMutation = useMutation({
    mutationFn: async () => {
      setIsCreatingCutoff(true);
      const response = await fetch("/api/transactions/cutoff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          total_ingresos: totals.totalIngresos,
          total_efectivo: totals.totalEfectivo,
          total_transferencias: totals.totalTransferencias
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Corte de caja exitoso",
        description: "Se ha realizado el corte de caja correctamente.",
        variant: "default",
      });
      
      // Invalidar la caché para recargar las transacciones
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/current"] });
      setIsCreatingCutoff(false);
    },
    onError: (error) => {
      toast({
        title: "Error al crear corte de caja",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
      setIsCreatingCutoff(false);
    },
  });
  
  const handleCreateCutoff = () => {
    if (reservationTransactions.length === 0 && packageTransactions.length === 0) {
      toast({
        title: "No hay transacciones para corte",
        description: "No hay transacciones pendientes para realizar un corte de caja.",
        variant: "destructive",
      });
      return;
    }
    
    createCutoffMutation.mutate();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Receipt className="mr-2 h-6 w-6" />
            Transacciones en Caja
          </div>
          <Button 
            variant="default" 
            className="ml-auto" 
            onClick={handleCreateCutoff}
            disabled={isCreatingCutoff || (reservationTransactions.length === 0 && packageTransactions.length === 0)}
          >
            {isCreatingCutoff ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Hacer Corte
              </>
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          Transacciones pendientes que no han sido incluidas en un corte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reservations">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reservations">
              Reservaciones ({reservationTransactions.length})
            </TabsTrigger>
            <TabsTrigger value="packages">
              Paqueterías ({packageTransactions.length})
            </TabsTrigger>
            <TabsTrigger value="cutoffs">
              Historial de Cortes
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
                    // Verificar que esta transacción pertenezca al usuario actual
                    // usando la transacción en lugar de los detalles
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDate(details.dateCreated || transaction.createdAt)}
                        </TableCell>
                        <TableCell>{transaction.id}</TableCell>
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
                    // Usar el ID de la transacción en lugar del ID del paquete para la consistencia
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDate(details.dateCreated || transaction.createdAt)}
                        </TableCell>
                        <TableCell>{transaction.id}</TableCell>
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

          {/* Tabla de Historial de Cortes */}
          <TabsContent value="cutoffs">
            <Table>
              <TableCaption>
                {isCutoffsLoading ? "Cargando historial de cortes..." : 
                  cutoffsData?.length === 0 ? "No hay cortes de caja registrados" :
                  "Historial de cortes de caja realizados"}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total Ingresos</TableHead>
                  <TableHead>Efectivo</TableHead>
                  <TableHead>Transferencias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCutoffsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : cutoffsData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <AlertCircle className="h-6 w-6 text-yellow-500 inline-block mr-2" />
                      No hay cortes de caja registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  cutoffsData?.map((cutoff) => (
                    <TableRow key={cutoff.id}>
                      <TableCell>{cutoff.id}</TableCell>
                      <TableCell>{formatDate(cutoff.fecha_fin)}</TableCell>
                      <TableCell>{formatCurrency(cutoff.total_ingresos)}</TableCell>
                      <TableCell>{formatCurrency(cutoff.total_efectivo)}</TableCell>
                      <TableCell>{formatCurrency(cutoff.total_transferencias)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Resumen del corte */}
      {(reservationTransactions.length > 0 || packageTransactions.length > 0) && (
        <CardFooter className="flex flex-col space-y-2 bg-gray-50 p-4 rounded-b-lg">
          <div className="w-full flex justify-between items-center">
            <h3 className="text-lg font-semibold">Resumen de transacciones</h3>
          </div>
          <div className="w-full grid grid-cols-3 gap-4">
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="text-sm text-gray-500">Total Ingresos</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(totals.totalIngresos)}</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="text-sm text-gray-500">Total Efectivo</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalEfectivo)}</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="text-sm text-gray-500">Total Transferencias</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(totals.totalTransferencias)}</div>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default TransactionBox;