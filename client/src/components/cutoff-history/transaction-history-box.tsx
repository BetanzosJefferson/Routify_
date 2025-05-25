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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { 
  Loader2, 
  Receipt, 
  DollarSign, 
  ArrowRight, 
  CreditCard, 
  Calendar, 
  BarChart, 
  Hash,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

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

const TransactionHistoryBox: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reservationTransactions, setReservationTransactions] = useState<Transaction[]>([]);
  const [packageTransactions, setPackageTransactions] = useState<Transaction[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  
  // Nuevo estado para almacenar transacciones agrupadas por corte
  const [cutoffGroups, setCutoffGroups] = useState<{
    [key: string]: {
      cutoffId: number;
      cutoffCode: string;
      transactions: Transaction[];
      totalAmount: number;
      cashAmount: number;
      transferAmount: number;
      reservationCount: number;
      packageCount: number;
      isExpanded: boolean; // Para controlar si se muestran las transacciones
    }
  }>({});

  // Consultar el historial de transacciones
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/transactions/cutoff-history", selectedPeriod],
    staleTime: 30000, // 30 segundos
    queryFn: async () => {
      const url = `/api/transactions/cutoff-history${selectedPeriod !== "all" ? `?period=${selectedPeriod}` : ""}`;
      const response = await fetch(url, {
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
      // Separar las transacciones por tipo y agrupar por corte
      const reservations: Transaction[] = [];
      const packages: Transaction[] = [];
      const groups: {
        [key: string]: {
          cutoffId: number;
          cutoffCode: string;
          transactions: Transaction[];
          totalAmount: number;
          cashAmount: number;
          transferAmount: number;
          reservationCount: number;
          packageCount: number;
        }
      } = {};

      if (Array.isArray(data)) {
        console.log("Transacciones recibidas:", data.length);
        
        data.forEach((transaction: any) => {
          try {
            // Verificar que la transacción y sus datos son válidos
            if (transaction && typeof transaction === 'object' && transaction.detalles && typeof transaction.detalles === 'object') {
              const transactionType = transaction.detalles.type;
              
              // Verificar que detalles.details existe
              if (!transaction.detalles.details) {
                console.warn("La transacción no tiene detalles.details:", transaction);
                return;
              }
              
              // Obtener el ID del corte (usar cutoff_id o id_corte, el que esté disponible)
              const cutoffId = transaction.cutoff_id || transaction.id_corte;
              if (!cutoffId) {
                console.warn("Transacción sin ID de corte:", transaction);
                return; // Ignorar transacciones sin corte
              }

              // Crear un código de corte formateado (CRT-20240517-001)
              const cutoffCode = `CRT-${cutoffId}`;
              
              // Inicializar el grupo si no existe
              if (!groups[cutoffId]) {
                groups[cutoffId] = {
                  cutoffId: cutoffId,
                  cutoffCode: cutoffCode,
                  transactions: [],
                  totalAmount: 0,
                  cashAmount: 0,
                  transferAmount: 0,
                  reservationCount: 0,
                  packageCount: 0,
                  isExpanded: false // Inicialmente todas las transacciones están ocultas
                };
              }
              
              // Añadir la transacción al grupo
              groups[cutoffId].transactions.push(transaction);
              
              // Actualizar montos
              const amount = transaction.detalles.details.monto || 0;
              groups[cutoffId].totalAmount += amount;
              
              if (transaction.detalles.details.metodoPago === "efectivo") {
                groups[cutoffId].cashAmount += amount;
              } else if (transaction.detalles.details.metodoPago === "transferencia") {
                groups[cutoffId].transferAmount += amount;
              }
              
              // Validar y contar por tipo de transacción
              if (transactionType === "reservation" || transactionType === "reservation-final-payment") {
                console.log("Añadiendo transacción de reservación:", transaction.id);
                reservations.push(transaction as Transaction);
                groups[cutoffId].reservationCount++;
              } else if (transactionType === "package" || transactionType === "package-final-payment") {
                console.log("Añadiendo transacción de paquetería:", transaction.id);
                packages.push(transaction as Transaction);
                groups[cutoffId].packageCount++;
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
        console.log("Grupos de cortes creados:", Object.keys(groups).length);
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
      setCutoffGroups(groups);
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
        <span className="ml-2">Cargando historial de transacciones...</span>
      </div>
    );
  }
  
  // Mostrar mensaje de error
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center p-8 text-red-500">
        <span className="font-bold">Error al cargar historial de transacciones:</span>
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

  // Calcular totales para el resumen
  let totalAmount = 0;
  let cashAmount = 0;
  let transferAmount = 0;

  // Sumar montos de reservaciones
  reservationTransactions.forEach(transaction => {
    const details = transaction.detalles?.details || {};
    const amount = details.monto || 0;
    totalAmount += amount;
    
    if (details.metodoPago === "efectivo") {
      cashAmount += amount;
    } else if (details.metodoPago === "transferencia") {
      transferAmount += amount;
    }
  });

  // Sumar montos de paqueterías
  packageTransactions.forEach(transaction => {
    const details = transaction.detalles?.details || {};
    const amount = details.monto || 0;
    totalAmount += amount;
    
    if (details.metodoPago === "efectivo") {
      cashAmount += amount;
    } else if (details.metodoPago === "transferencia") {
      transferAmount += amount;
    }
  });
  
  // Total de transacciones
  const totalTransactions = reservationTransactions.length + packageTransactions.length;

  const totals = {
    total: totalAmount,
    efectivo: cashAmount,
    transferencia: transferAmount
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };
  
  // Función para expandir/contraer un grupo de transacciones
  const toggleGroupExpansion = (cutoffId: number) => {
    setCutoffGroups(prevGroups => {
      const updatedGroups = { ...prevGroups };
      if (updatedGroups[cutoffId]) {
        updatedGroups[cutoffId] = {
          ...updatedGroups[cutoffId],
          isExpanded: !updatedGroups[cutoffId].isExpanded
        };
      }
      return updatedGroups;
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div>
            <CardTitle className="flex items-center">
              <Receipt className="mr-2 h-6 w-6" />
              Historial de Transacciones
            </CardTitle>
            <CardDescription>
              Transacciones históricas que ya han sido incluidas en cortes
            </CardDescription>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <Button 
              variant={selectedPeriod === "all" ? "default" : "outline"} 
              onClick={() => handlePeriodChange("all")}
            >
              Todos
            </Button>
            <Button 
              variant={selectedPeriod === "week" ? "default" : "outline"} 
              onClick={() => handlePeriodChange("week")}
            >
              Última semana
            </Button>
            <Button 
              variant={selectedPeriod === "month" ? "default" : "outline"} 
              onClick={() => handlePeriodChange("month")}
            >
              Último mes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mostrar un mensaje cuando no hay datos */}
        {!data || Object.keys(cutoffGroups).length === 0 ? (
          <div className="text-center p-8 bg-muted/20 rounded-lg">
            <h3 className="text-lg font-medium mb-2">No hay transacciones en el historial</h3>
            <p className="text-muted-foreground">
              No se encontraron transacciones con cortes asociados en el período seleccionado.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tarjetas de cortes */}
            {Object.values(cutoffGroups).map((group) => (
              <Card key={group.cutoffId} className="bg-blue-50 border-blue-200 overflow-hidden">
                <CardHeader className="bg-blue-100 pb-2">
                  <div className="flex flex-col space-y-2">
                    <CardTitle className="text-lg flex items-center">
                      <BarChart className="h-5 w-5 mr-2 text-primary" />
                      Resumen de Transacciones
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-md p-3 flex items-center justify-between border border-blue-100">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Transacciones</p>
                        <p className="text-xl font-bold">{group.transactions.length}</p>
                      </div>
                      <BarChart className="h-8 w-8 text-primary opacity-70" />
                    </div>
                    
                    <div className="bg-white rounded-md p-3 flex items-center justify-between border border-blue-100">
                      <div>
                        <p className="text-sm text-muted-foreground">ID del Corte</p>
                        <p className="text-xl font-bold flex items-center">
                          <Hash className="h-4 w-4 mr-1 text-primary" />
                          {group.cutoffCode}
                        </p>
                      </div>
                      <Hash className="h-8 w-8 text-primary opacity-70" />
                    </div>
                    
                    <div className="bg-white rounded-md p-3 flex items-center justify-between border border-blue-100">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Ingreso</p>
                        <p className="text-xl font-bold">{formatCurrency(group.totalAmount)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-primary opacity-70" />
                    </div>
                    
                    <div className="bg-white rounded-md p-3 grid grid-cols-2 gap-2 border border-blue-100">
                      <div className="flex items-center">
                        <ArrowRight className="h-5 w-5 mr-2 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Efectivo</p>
                          <p className="text-sm font-bold">{formatCurrency(group.cashAmount)}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ArrowUpRight className="h-5 w-5 mr-2 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Transferencia</p>
                          <p className="text-sm font-bold">{formatCurrency(group.transferAmount)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botón para mostrar/ocultar transacciones */}
                  <div className="flex justify-center my-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleGroupExpansion(group.cutoffId)}
                      className="text-sm flex items-center gap-1"
                    >
                      {group.isExpanded ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Ocultar transacciones
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Mostrar transacciones
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Secciones expandibles de transacciones */}
                  {group.isExpanded && (
                    <>
                      {/* Sección de Reservaciones */}
                      {group.reservationCount > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center mb-2">
                            <h3 className="text-sm font-semibold">Reservaciones ({group.reservationCount})</h3>
                          </div>
                          
                          <div className="bg-white rounded-md overflow-hidden border border-blue-100">
                            <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">ID</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Origen-Destino</TableHead>
                              <TableHead>Pasajeros</TableHead>
                              <TableHead>Método</TableHead>
                              <TableHead>Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.transactions.filter(t => 
                              t.detalles?.type === "reservation" || t.detalles?.type === "reservation-final-payment"
                            ).map((transaction) => {
                              try {
                                const details = transaction.detalles?.details || {};
                                return (
                                  <TableRow key={transaction.id}>
                                    <TableCell>{transaction.id}</TableCell>
                                    <TableCell>
                                      {formatDate(details.dateCreated || transaction.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-xs">
                                        <div className="font-medium">{details.origen}</div>
                                        <div className="mt-1">{details.destino}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell>{details.pasajeros || 'N/A'}</TableCell>
                                    <TableCell>
                                      <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                                        {details.metodoPago || "N/A"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatCurrency(details.monto || 0)}</TableCell>
                                  </TableRow>
                                );
                              } catch (error) {
                                console.error("Error al renderizar transacción:", error, transaction);
                                return null;
                              }
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Sección de Paqueterías */}
                  {group.packageCount > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <h3 className="text-sm font-semibold">Paqueterías ({group.packageCount})</h3>
                      </div>
                      
                      <div className="bg-white rounded-md overflow-hidden border border-blue-100">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">ID</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Origen-Destino</TableHead>
                              <TableHead>Remitente/Destinatario</TableHead>
                              <TableHead>Método</TableHead>
                              <TableHead>Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.transactions.filter(t => 
                              t.detalles?.type === "package" || t.detalles?.type === "package-final-payment"
                            ).map((transaction) => {
                              try {
                                const details = transaction.detalles?.details || {};
                                return (
                                  <TableRow key={transaction.id}>
                                    <TableCell>{transaction.id}</TableCell>
                                    <TableCell>
                                      {formatDate(details.dateCreated || transaction.createdAt)}
                                    </TableCell>
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
                                      <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                                        {details.metodoPago || "N/A"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatCurrency(details.monto || 0)}</TableCell>
                                  </TableRow>
                                );
                              } catch (error) {
                                console.error("Error al renderizar transacción:", error, transaction);
                                return null;
                              }
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistoryBox;