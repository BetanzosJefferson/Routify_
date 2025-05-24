import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

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
  DollarSign,
  Banknote,
  CreditCard,
  Package,
  ArrowDownUp,
  Calendar,
  Clock,
  Loader2,
  PlusCircle,
  Search,
  UserCheck,
  BanknoteIcon,
  Trash,
  PackageCheck,
  User,
  ArrowUpRight,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// Tipo para una transacción
type Transaccion = {
  id: number;
  tipo: string;
  monto: number;
  metodoPago: string;
  estado: string;
  descripcion: string;
  referencia: string;
  createdAt: string;
  reservacionId?: number;
  paqueteriaId?: number;
};

export function CajaNuevaPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [metodoPagoFilter, setMetodoPagoFilter] = useState("todos");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Estado para el modal de corte
  const [showCutoffModal, setShowCutoffModal] = useState(false);
  const [notasCorte, setNotasCorte] = useState("");
  const [isLoadingCutoff, setIsLoadingCutoff] = useState(false);
  
  // Estado para el modal de gasto
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [montoGasto, setMontoGasto] = useState("");
  const [descripcionGasto, setDescripcionGasto] = useState("");
  const [isLoadingGasto, setIsLoadingGasto] = useState(false);
  
  // Obtener las transacciones sin cortar
  const { 
    data: transacciones, 
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["/api/caja/transacciones"],
    queryFn: async () => {
      const response = await fetch('/api/caja/transacciones');
      if (!response.ok) {
        throw new Error("Error al cargar transacciones");
      }
      return await response.json();
    }
  });
  
  // Filtrar las transacciones
  const filteredTransacciones = transacciones?.filter((transaccion: Transaccion) => {
    // Filtro por texto
    const searchMatch = !searchTerm || 
      transaccion.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaccion.referencia.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por tipo
    const tipoMatch = tipoFilter === "todos" || transaccion.tipo === tipoFilter;
    
    // Filtro por método de pago
    const metodoPagoMatch = metodoPagoFilter === "todos" || transaccion.metodoPago === metodoPagoFilter;
    
    return searchMatch && tipoMatch && metodoPagoMatch;
  }) || [];
  
  // Ordenar las transacciones
  const sortedTransacciones = [...filteredTransacciones].sort((a, b) => {
    if (sortDirection === "desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });
  
  // Calcular totales
  const totalEfectivo = filteredTransacciones
    .filter(t => t.metodoPago === "efectivo" && t.tipo !== "gasto")
    .reduce((sum, t) => sum + t.monto, 0);
  
  const totalTransferencia = filteredTransacciones
    .filter(t => t.metodoPago === "transferencia" && t.tipo !== "gasto")
    .reduce((sum, t) => sum + t.monto, 0);
  
  const totalGastos = filteredTransacciones
    .filter(t => t.tipo === "gasto")
    .reduce((sum, t) => sum + t.monto, 0);
  
  const totalGeneral = totalEfectivo + totalTransferencia - totalGastos;
  
  // Función para cambiar la dirección de ordenación
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "desc" ? "asc" : "desc");
  };
  
  // Función para realizar un corte de caja
  const handleCutoff = async () => {
    if (filteredTransacciones.length === 0) {
      toast({
        title: "No hay transacciones",
        description: "No hay transacciones para realizar un corte",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoadingCutoff(true);
    
    try {
      const response = await fetch('/api/caja/corte', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notas: notasCorte })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al realizar corte de caja");
      }
      
      const data = await response.json();
      
      toast({
        title: "Corte realizado",
        description: `Se ha realizado el corte con éxito. Total: ${formatCurrency(data.corte.totalGeneral)}`,
      });
      
      // Cerrar modal y recargar datos
      setShowCutoffModal(false);
      setNotasCorte("");
      queryClient.invalidateQueries({ queryKey: ["/api/caja/transacciones"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al realizar el corte de caja",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCutoff(false);
    }
  };
  
  // Función para registrar un gasto
  const handleGasto = async () => {
    if (!montoGasto || !descripcionGasto) {
      toast({
        title: "Datos incompletos",
        description: "Debe ingresar monto y descripción del gasto",
        variant: "destructive"
      });
      return;
    }
    
    // Convertir monto a número
    const monto = parseFloat(montoGasto);
    if (isNaN(monto) || monto <= 0) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser un número mayor a cero",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoadingGasto(true);
    
    try {
      const response = await fetch('/api/caja/gasto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          monto, 
          descripcion: descripcionGasto 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al registrar gasto");
      }
      
      toast({
        title: "Gasto registrado",
        description: `Se ha registrado el gasto de ${formatCurrency(monto)} correctamente`,
      });
      
      // Cerrar modal y recargar datos
      setShowGastoModal(false);
      setMontoGasto("");
      setDescripcionGasto("");
      queryClient.invalidateQueries({ queryKey: ["/api/caja/transacciones"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al registrar el gasto",
        variant: "destructive"
      });
    } finally {
      setIsLoadingGasto(false);
    }
  };
  
  // Función para sincronizar transacciones desde tablas existentes
  const handleSincronizar = async () => {
    try {
      const response = await fetch('/api/caja/sincronizar', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al sincronizar transacciones");
      }
      
      const data = await response.json();
      
      toast({
        title: "Sincronización completa",
        description: data.message,
      });
      
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: ["/api/caja/transacciones"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al sincronizar transacciones",
        variant: "destructive"
      });
    }
  };
  
  // Función para mostrar el tipo de transacción
  const getTipoTransaccion = (tipo: string) => {
    switch (tipo) {
      case "anticipo": return "Anticipo";
      case "restante": return "Pago restante";
      case "paqueteria": return "Paquetería";
      case "gasto": return "Gasto";
      default: return tipo;
    }
  };
  
  // Función para mostrar el método de pago
  const getMetodoPago = (metodo: string) => {
    switch (metodo) {
      case "efectivo": return "Efectivo";
      case "transferencia": return "Transferencia";
      default: return metodo;
    }
  };
  
  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Caja</h2>
        
        {/* Botones de acción */}
        <div className="ml-auto flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowGastoModal(true)}
            className="flex items-center gap-1"
          >
            <Trash className="h-4 w-4" />
            <span>Registrar gasto</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => refetch()}
            className="flex items-center gap-1"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Recargar</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="default" 
            onClick={() => setShowCutoffModal(true)}
            className="flex items-center gap-1"
          >
            <BanknoteIcon className="h-4 w-4" />
            <span>Realizar corte</span>
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex flex-grow items-center gap-3">
                <div className="relative flex-grow">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Buscar transacción..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex flex-row gap-2">
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tipo de transacción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="anticipo">Anticipos</SelectItem>
                    <SelectItem value="restante">Pagos restantes</SelectItem>
                    <SelectItem value="paqueteria">Paqueterías</SelectItem>
                    <SelectItem value="gasto">Gastos</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={metodoPagoFilter} onValueChange={setMetodoPagoFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los métodos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Resumen de transacciones */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <DollarSign className="h-5 w-5 text-primary mr-2" />
                    <p className="text-sm font-medium">Total en Caja</p>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(totalGeneral)}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <Banknote className="h-5 w-5 text-green-600 mr-2" />
                    <p className="text-sm font-medium">Efectivo</p>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(totalEfectivo)}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                    <p className="text-sm font-medium">Transferencia</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalTransferencia)}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <Trash className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm font-medium">Gastos</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalGastos)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-md">Transacciones pendientes de corte</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSortDirection}
              className="flex items-center gap-1"
            >
              <ArrowDownUp className="h-4 w-4" />
              <span>{sortDirection === "desc" ? "Más recientes primero" : "Más antiguos primero"}</span>
            </Button>
          </div>
          <CardDescription className="mt-1">
            {`Mostrando ${sortedTransacciones.length} transacciones sin cortar`}
          </CardDescription>
        </CardHeader>
        
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg text-muted-foreground">Cargando transacciones...</span>
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <p className="text-red-500 mb-2">Error al cargar las transacciones</p>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Intentar nuevamente
              </Button>
            </div>
          ) : sortedTransacciones.length === 0 ? (
            <div className="text-center py-10">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay transacciones</h3>
              <p className="text-muted-foreground mb-4">
                No hay transacciones sin cortar en este momento.
              </p>
              
              {/* Botón para sincronizar desde tablas existentes */}
              <Button variant="outline" onClick={handleSincronizar}>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Sincronizar desde datos existentes
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Total de transacciones sin cortar: {sortedTransacciones.length}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Tipo</TableHead>
                      <TableHead className="w-[150px]">Método</TableHead>
                      <TableHead>Referencia / Descripción</TableHead>
                      <TableHead className="w-[150px]">Fecha</TableHead>
                      <TableHead className="text-right w-[150px]">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransacciones.map((transaccion: Transaccion) => (
                      <TableRow key={`${transaccion.id}-${transaccion.tipo}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {transaccion.tipo === "anticipo" ? (
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                            ) : transaccion.tipo === "restante" ? (
                              <ArrowUpRight className="h-4 w-4 text-blue-600" />
                            ) : transaccion.tipo === "paqueteria" ? (
                              <PackageCheck className="h-4 w-4 text-purple-600" />
                            ) : transaccion.tipo === "gasto" ? (
                              <Trash className="h-4 w-4 text-red-600" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-primary" />
                            )}
                            {getTipoTransaccion(transaccion.tipo)}
                          </div>
                          
                          {transaccion.reservacionId && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Reservación #{transaccion.reservacionId}
                            </div>
                          )}
                          
                          {transaccion.paqueteriaId && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Paquetería #{transaccion.paqueteriaId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transaccion.metodoPago === "efectivo" ? (
                              <Banknote className="h-4 w-4 text-green-600" />
                            ) : (
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            )}
                            {getMetodoPago(transaccion.metodoPago)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {transaccion.referencia || "Sin referencia"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {transaccion.descripcion}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center text-sm">
                              <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                              {new Date(transaccion.createdAt).toLocaleDateString('es-MX')}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Clock className="mr-1 h-3 w-3" />
                              {new Date(transaccion.createdAt).toLocaleTimeString('es-MX', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={
                            transaccion.tipo === "gasto" 
                              ? "text-red-600 font-medium" 
                              : "font-medium"
                          }>
                            {transaccion.tipo === "gasto" ? "-" : ""}{formatCurrency(transaccion.monto)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </Card>
      
      {/* Modal para realizar corte de caja */}
      <Dialog open={showCutoffModal} onOpenChange={setShowCutoffModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Realizar corte de caja</DialogTitle>
            <DialogDescription>
              Esto marcará todas las transacciones como cortadas y generará un registro de corte.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium mb-1">En efectivo</p>
                <p className="text-xl font-semibold">{formatPrice(totalEfectivo)}</p>
              </div>
              
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium mb-1">Transferencia</p>
                <p className="text-xl font-semibold">{formatPrice(totalTransferencia)}</p>
              </div>
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium mb-1">Gastos</p>
              <p className="text-xl font-semibold text-red-600">{formatPrice(totalGastos)}</p>
            </div>
            
            <Separator />
            
            <div className="bg-primary/10 p-3 rounded-md">
              <p className="text-sm font-medium mb-1">Total corte</p>
              <p className="text-2xl font-bold">{formatPrice(totalGeneral)}</p>
            </div>
            
            <div>
              <label htmlFor="notas" className="text-sm font-medium block mb-2">
                Notas adicionales (opcional)
              </label>
              <Input
                id="notas"
                placeholder="Notas sobre este corte..."
                value={notasCorte}
                onChange={(e) => setNotasCorte(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCutoffModal(false)}
              disabled={isLoadingCutoff}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCutoff}
              disabled={isLoadingCutoff || filteredTransacciones.length === 0}
            >
              {isLoadingCutoff ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <BanknoteIcon className="mr-2 h-4 w-4" />
                  Realizar corte
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para registrar gasto */}
      <Dialog open={showGastoModal} onOpenChange={setShowGastoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar gasto</DialogTitle>
            <DialogDescription>
              Ingrese los detalles del gasto que desea registrar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="monto" className="text-sm font-medium block mb-2">
                Monto del gasto
              </label>
              <Input
                id="monto"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={montoGasto}
                onChange={(e) => setMontoGasto(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="descripcion" className="text-sm font-medium block mb-2">
                Descripción del gasto
              </label>
              <Input
                id="descripcion"
                placeholder="¿En qué se utilizó este dinero?"
                value={descripcionGasto}
                onChange={(e) => setDescripcionGasto(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowGastoModal(false)}
              disabled={isLoadingGasto}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleGasto}
              disabled={isLoadingGasto || !montoGasto || !descripcionGasto}
            >
              {isLoadingGasto ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Trash className="mr-2 h-4 w-4" />
                  Registrar gasto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}