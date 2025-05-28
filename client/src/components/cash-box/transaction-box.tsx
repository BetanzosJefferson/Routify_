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
import { Loader2, Receipt, DollarSign, ArrowRight, CreditCard, Scissors, FileText, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateTicket } from "./ticket-generator";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const queryClient = useQueryClient();
  const [reservationTransactions, setReservationTransactions] = useState<Transaction[]>([]);
  const [packageTransactions, setPackageTransactions] = useState<Transaction[]>([]);
  const [isCreatingCutoff, setIsCreatingCutoff] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [lastCutoff, setLastCutoff] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  
  // Función para generar el PDF del ticket
  const generateTicketPDF = async (cutoff: any, transactions: Transaction[]) => {
    try {
      // Preparar la configuración para el ticket
      const ticketConfig = {
        title: "CORTE DE CAJA",
        date: new Date().toLocaleString("es-MX"),
        user: user?.firstName + " " + user?.lastName || "Usuario",
        company: user?.companyId || "Empresa",
        transactions: transactions,
        totals: {
          totalIngresos: totals.total,
          totalEfectivo: totals.efectivo,
          totalTransferencias: totals.transferencia,
        },
        cutoffId: cutoff.id,
        startDate: new Date(cutoff.fecha_inicio).toLocaleString("es-MX"),
        endDate: new Date(cutoff.fecha_fin).toLocaleString("es-MX"),
      };
      
      // Generar el PDF
      const pdfBase64 = await generateTicket(ticketConfig);
      setPdfUrl(pdfBase64);
      setPdfDialogOpen(true);
      
      return pdfBase64;
    } catch (error) {
      console.error("Error al generar el ticket PDF:", error);
      toast({
        title: "Error al generar el ticket",
        description: "No se pudo generar el PDF del ticket. Inténtalo nuevamente.",
        variant: "destructive",
      });
      return null;
    }
  };

  // Mutación para crear un nuevo corte de caja
  const createCutoffMutation = useMutation({
    mutationFn: async () => {
      // Capturar todas las transacciones actuales para el PDF antes de hacer el corte
      const allTransactions = [...reservationTransactions, ...packageTransactions];
      console.log("Guardando transacciones para PDF:", allTransactions.length);
      
      // Preparar el cuerpo de la petición con información del filtro de empresa para usuarios taquilla
      const requestBody: any = {};
      if (user?.role === "taquilla" && selectedCompany !== "all") {
        requestBody.companyFilter = selectedCompany;
        console.log("Enviando filtro de empresa al backend:", selectedCompany);
      }
      
      console.log("Request body que se enviará:", requestBody);
      
      const response = await fetch('/api/box/cutoff', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        ...data,
        capturedTransactions: allTransactions // Pasar las transacciones junto con la respuesta
      };
    },
    onMutate: () => {
      setIsCreatingCutoff(true);
    },
    onSuccess: async (data) => {
      toast({
        title: "Corte realizado con éxito",
        description: `Se han procesado ${data.transactionCount} transacciones en el corte #${data.cutoff.id}`,
        variant: "default",
      });
      
      // Invalidar consulta para recargar las transacciones
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/current'] });
      setIsCreatingCutoff(false);
      
      // Redirigir al historial de cortes
      window.location.href = '/cutoff-history';
    },
    onError: (error) => {
      toast({
        title: "Error al realizar el corte",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
      setIsCreatingCutoff(false);
    }
  });
  
  // Función para manejar el clic en el botón "Hacer corte"
  const handleCreateCutoff = () => {
    if (totalTransactions === 0) {
      toast({
        title: "No hay transacciones para realizar el corte",
        description: "Debe haber al menos una transacción para crear un corte de caja",
        variant: "destructive",
      });
      return;
    }

    // Validación específica para usuarios con rol "taquilla"
    if (user?.role === "taquilla" && selectedCompany === "all") {
      toast({
        title: "Debe seleccionar una empresa",
        description: "Para realizar un corte, primero debe seleccionar una empresa específica en el filtro",
        variant: "destructive",
      });
      return;
    }
    
    createCutoffMutation.mutate();
  };

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

  // Consultar las empresas (solo para usuarios taquilla)
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    staleTime: 300000, // 5 minutos
    enabled: user?.role === "taquilla",
    queryFn: async () => {
      const response = await fetch("/api/companies", {
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

              // Filtrar por empresa si el usuario es taquilla y se ha seleccionado una empresa específica
              if (user.role === "taquilla" && selectedCompany !== "all") {
                const transactionCompanyId = transaction.companyId || transaction.detalles?.details?.companyId;
                if (transactionCompanyId !== selectedCompany) {
                  console.log(`Omitiendo transacción ${transaction.id} porque no pertenece a la empresa seleccionada (${selectedCompany}), empresa de transacción: ${transactionCompanyId}`);
                  return;
                }
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
  }, [data, toast, user, selectedCompany]);

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

  // Función para descargar el PDF
  const handleDownloadPdf = () => {
    if (pdfUrl) {
      // Crear un enlace temporal para descargar el PDF
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `corte-caja-${lastCutoff?.cutoff.id || 'ticket'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Función para cerrar el diálogo del PDF
  const handleClosePdfDialog = () => {
    setPdfDialogOpen(false);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div>
              <CardTitle className="flex items-center">
                <Receipt className="mr-2 h-6 w-6" />
                Transacciones en Caja
              </CardTitle>
              <CardDescription>
                Transacciones pendientes que no han sido incluidas en un corte
              </CardDescription>
            </div>
            <Button
              className="mt-4 md:mt-0"
              onClick={handleCreateCutoff}
              disabled={isCreatingCutoff || totalTransactions === 0}
            >
              {isCreatingCutoff ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Scissors className="mr-2 h-4 w-4" />
                  Hacer corte
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtro por empresa (solo para usuarios taquilla) */}
          {user?.role === "taquilla" && companies && (
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <label htmlFor="company-filter" className="text-sm font-medium">
                  Filtrar por empresa:
                </label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Selecciona una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {companies.map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Resumen de totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between md:justify-center">
              <div className="flex items-center">
                <DollarSign className="h-6 w-6 mr-2 text-primary" />
                <div>
                  <p className="text-sm font-medium">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(totals.total)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-center">
              <div className="flex items-center">
                <ArrowRight className="h-6 w-6 mr-2 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Efectivo</p>
                  <p className="text-xl font-bold">{formatCurrency(totals.efectivo)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-center">
              <div className="flex items-center">
                <CreditCard className="h-6 w-6 mr-2 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Transferencia</p>
                  <p className="text-xl font-bold">{formatCurrency(totals.transferencia)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtro por empresa (solo para usuarios taquilla) */}
          {user?.role === "taquilla" && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-4">
                <label htmlFor="company-filter" className="text-sm font-medium text-gray-700">
                  Filtrar por empresa:
                </label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Selecciona una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {/* Obtener empresas únicas de TODAS las transacciones sin filtrar */}
                    {Array.from(
                      new Set([
                        ...(data || []).filter(t => t.companyId).map(t => t.companyId)
                      ])
                    ).map((companyId) => (
                      <SelectItem key={companyId} value={companyId}>
                        {companyId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Sección de Reservaciones */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold">Reservaciones ({reservationTransactions.length})</h3>
            </div>
            
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Table>
                <TableCaption>
                  {reservationTransactions.length === 0
                    ? "No hay transacciones de reservaciones pendientes"
                    : "Lista de transacciones de reservaciones"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen-Destino</TableHead>
                    <TableHead>Pasajeros</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Monto</TableHead>
                    {user?.role === "taquilla" && <TableHead>Empresa</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservationTransactions.map((transaction) => {
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
                          {user?.role === "taquilla" && (
                            <TableCell>
                              <div className="text-xs font-mono">
                                {transaction.companyId || 'N/A'}
                              </div>
                            </TableCell>
                          )}
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

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {reservationTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay transacciones de reservaciones pendientes
                </div>
              ) : (
                reservationTransactions.map((transaction) => {
                  try {
                    const details = transaction.detalles?.details || {};
                    return (
                      <div key={transaction.id} className="border rounded-xl p-4 bg-white">
                        {/* Header con ID y fecha */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">ID #{transaction.id}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(details.dateCreated || transaction.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-sm">
                              {formatCurrency(details.monto || 0)}
                            </p>
                            <Badge 
                              variant={details.metodoPago === "efectivo" ? "default" : "secondary"}
                              className="text-xs mt-1"
                            >
                              {details.metodoPago || "N/A"}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Ruta */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-500">Origen - Destino</p>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 truncate">{details.origen}</div>
                            <div className="text-gray-700 truncate">{details.destino}</div>
                          </div>
                        </div>
                        
                        {/* Información adicional */}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <div>
                            <p className="text-xs text-gray-500">Pasajeros</p>
                            <p className="text-sm font-medium text-gray-900">{details.pasajeros || 'N/A'}</p>
                          </div>
                          {user?.role === "taquilla" && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Empresa</p>
                              <p className="text-xs font-mono text-gray-900">{transaction.companyId || 'N/A'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } catch (error) {
                    console.error("Error al renderizar transacción:", error, transaction);
                    return null;
                  }
                })
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Sección de Paqueterías */}
          <div>
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold">Paqueterías ({packageTransactions.length})</h3>
            </div>
            
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Table>
                <TableCaption>
                  {packageTransactions.length === 0
                    ? "No hay transacciones de paqueterías pendientes"
                    : "Lista de transacciones de paqueterías"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen-Destino</TableHead>
                    <TableHead>Remitente/Destinatario</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Monto</TableHead>
                    {user?.role === "taquilla" && <TableHead>Empresa</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packageTransactions.map((transaction) => {
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
                            <div className="text-xs max-w-[150px] truncate">
                              {details.descripcion || "Sin descripción"}
                              {details.usaAsientos && (
                                <Badge variant="outline" className="ml-1">
                                  {details.asientos} asiento{details.asientos !== 1 && "s"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={details.metodoPago === "efectivo" ? "default" : "secondary"}>
                              {details.metodoPago || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(details.monto || 0)}</TableCell>
                          {user?.role === "taquilla" && (
                            <TableCell>
                              <div className="text-xs font-mono">
                                {transaction.companyId || 'N/A'}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    } catch (error) {
                      console.error("Error al renderizar transacción de paquete:", error, transaction);
                      return null;
                    }
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {packageTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay transacciones de paqueterías pendientes
                </div>
              ) : (
                packageTransactions.map((transaction) => {
                  try {
                    const details = transaction.detalles?.details || {};
                    return (
                      <div key={transaction.id} className="border rounded-xl p-4 bg-white">
                        {/* Header con ID y fecha */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">ID #{transaction.id}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(details.dateCreated || transaction.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-sm">
                              {formatCurrency(details.monto || 0)}
                            </p>
                            <Badge 
                              variant={details.metodoPago === "efectivo" ? "default" : "secondary"}
                              className="text-xs mt-1"
                            >
                              {details.metodoPago || "N/A"}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Ruta */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-500">Origen - Destino</p>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 truncate">{details.origen}</div>
                            <div className="text-gray-700 truncate">{details.destino}</div>
                          </div>
                        </div>
                        
                        {/* Remitente y Destinatario */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-500">Remitente</p>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            De: {details.remitente || 'No especificado'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Destinatario</p>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            Para: {details.destinatario || 'No especificado'}
                          </p>
                        </div>
                        
                        {/* Descripción y información adicional */}
                        <div className="flex justify-between items-start pt-2 border-t border-gray-100">
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="text-xs text-gray-500">Descripción</p>
                            <p className="text-sm text-gray-900 truncate">
                              {details.descripcion || "Sin descripción"}
                            </p>
                            {details.usaAsientos && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {details.asientos} asiento{details.asientos !== 1 && "s"}
                              </Badge>
                            )}
                          </div>
                          {user?.role === "taquilla" && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Empresa</p>
                              <p className="text-xs font-mono text-gray-900">{transaction.companyId || 'N/A'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } catch (error) {
                    console.error("Error al renderizar transacción de paquete:", error, transaction);
                    return null;
                  }
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para mostrar el PDF */}
      <Dialog open={pdfDialogOpen} onOpenChange={handleClosePdfDialog}>
        <DialogContent className="max-w-screen-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Ticket de corte de caja
            </DialogTitle>
            <DialogDescription>
              Se ha generado un ticket para este corte de caja. Puedes visualizarlo y descargarlo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 border rounded-md overflow-hidden">
            {pdfUrl ? (
              <iframe 
                src={pdfUrl} 
                className="w-full h-[70vh]" 
                title="Ticket de corte" 
              />
            ) : (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Generando PDF...</span>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={handleClosePdfDialog}
            >
              Cerrar
            </Button>
            <Button 
              onClick={handleDownloadPdf}
              disabled={!pdfUrl}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TransactionBox;