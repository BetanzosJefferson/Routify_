import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar as CalendarIcon, 
  EyeIcon, 
  PlusCircleIcon, 
  MinusCircleIcon,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DefaultLayout } from "@/components/layout/default-layout";

// Componentes UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Interfaces para los modelos de datos
interface Trip {
  id: number;
  routeId: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  vehicleId?: number;
  driverId?: number;
  vehicle?: {
    id: number;
    plates: string;
    brand: string;
    model: string;
  };
  driver?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  route: {
    id: number;
    name: string;
    origin: string;
    destination: string;
  };
}

interface TripWithFinancials extends Trip {
  passengerCount: number;
  ticketSales: number;
  packageCount: number;
  packageSales: number;
  totalSales: number;
  expenses: number;
  profit: number;
}

interface Passenger {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  reservationId: number;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentMethod?: string;
}

interface Package {
  id: number;
  trackingCode: string;
  senderName: string;
  recipientName: string;
  weight: number;
  description?: string;
  price: number;
  status: string;
  tripId: number;
}

interface Expense {
  id: number;
  tripId: number;
  amount: number;
  category: string;
  description?: string;
  createdAt?: Date;
}

// Componente de contenido para el historial de ventas
function SalesHistoryContent() {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [trips, setTrips] = useState<TripWithFinancials[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [tripBudget, setTripBudget] = useState<number>(0);
  const [isUpdatingBudget, setIsUpdatingBudget] = useState(false);

  // Estado para el formulario de nuevos gastos
  const [newExpense, setNewExpense] = useState({
    amount: 0,
    category: "combustible",
    description: ""
  });
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const { toast } = useToast();

  // Consultar todos los viajes con información financiera
  const { 
    data: tripsData, 
    isLoading: isLoadingTrips,
    refetch: refetchTrips
  } = useQuery({
    queryKey: ['/api/trips/financials'],
    refetchOnWindowFocus: false
  });

  // Cargar todos los viajes al iniciar
  useEffect(() => {
    if (tripsData && Array.isArray(tripsData)) {
      console.log("Datos financieros recibidos:", tripsData);
      setTrips(tripsData);
    }
  }, [tripsData]);

  // Carga los datos de un viaje específico al seleccionarlo
  const loadTripDetails = async (tripId: number) => {
    try {
      setIsLoadingDetails(true);
      setSelectedTripId(tripId);
      
      // 1. Cargar los pasajeros del viaje
      const passengersResponse = await fetch(`/api/trips/${tripId}/passengers`);
      const passengersData = await passengersResponse.json();
      setPassengers(passengersData);
      
      // 2. Cargar los paquetes del viaje
      const packagesResponse = await fetch(`/api/trips/${tripId}/packages`);
      const packagesData = await packagesResponse.json();
      setPackages(packagesData);
      
      // 3. Cargar los gastos del viaje
      const expensesResponse = await fetch(`/api/trips/${tripId}/expenses`);
      const expensesData = await expensesResponse.json();
      setExpenses(expensesData.map((expense: Expense) => ({
        ...expense,
        amount: parseFloat(expense.amount.toString())
      })));
      
      // 4. Cargar el presupuesto del viaje
      const budgetResponse = await fetch(`/api/trips/${tripId}/budget`);
      const budgetData = await budgetResponse.json();
      setTripBudget(budgetData?.amount || 0);
      
    } catch (error) {
      console.error("Error al cargar detalles del viaje:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al cargar los detalles del viaje",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Actualizar el presupuesto del viaje
  const updateBudget = async () => {
    if (!selectedTripId) return;
    
    try {
      setIsUpdatingBudget(true);
      
      const response = await apiRequest('POST', '/api/trips/budget/update', {
        tripId: selectedTripId,
        amount: tripBudget
      });
      
      if (response.success) {
        toast({
          title: "Presupuesto actualizado",
          description: "El presupuesto del viaje ha sido actualizado correctamente",
        });
      } else {
        throw new Error(response.message || "Error al actualizar el presupuesto");
      }
      
    } catch (error) {
      console.error("Error al actualizar presupuesto:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al actualizar el presupuesto del viaje",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingBudget(false);
    }
  };

  // Añadir un nuevo gasto al viaje
  const addExpense = async () => {
    if (!selectedTripId || !newExpense.category || newExpense.amount <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Por favor, completa todos los campos del gasto",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsAddingExpense(true);
      
      const response = await apiRequest('POST', `/api/trips/${selectedTripId}/expenses/add`, {
        ...newExpense,
        tripId: selectedTripId
      });
      
      if (response.success) {
        // Recargar los gastos del viaje
        const expensesResponse = await fetch(`/api/trips/${selectedTripId}/expenses`);
        const expensesData = await expensesResponse.json();
        setExpenses(expensesData.map((expense: Expense) => ({
          ...expense,
          amount: parseFloat(expense.amount.toString())
        })));
        
        // Limpiar el formulario
        setNewExpense({
          amount: 0,
          category: "combustible",
          description: ""
        });
        
        toast({
          title: "Gasto añadido",
          description: "El gasto ha sido añadido correctamente al viaje",
        });
        
        // Recargar los datos financieros
        refetchTrips();
        
      } else {
        throw new Error(response.message || "Error al añadir el gasto");
      }
      
    } catch (error) {
      console.error("Error al añadir gasto:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al añadir el gasto al viaje",
        variant: "destructive"
      });
    } finally {
      setIsAddingExpense(false);
    }
  };

  // Eliminar un gasto
  const deleteExpense = async (expenseId: number) => {
    if (!selectedTripId) return;
    
    try {
      const response = await apiRequest('POST', "/api/trips/expenses/remove", {
        expenseId
      });
      
      if (response.success) {
        // Actualizar los gastos localmente
        setExpenses(expenses.filter(expense => expense.id !== expenseId));
        
        toast({
          title: "Gasto eliminado",
          description: "El gasto ha sido eliminado correctamente",
        });
        
        // Recargar los datos financieros
        refetchTrips();
        
      } else {
        throw new Error(response.message || "Error al eliminar el gasto");
      }
      
    } catch (error) {
      console.error("Error al eliminar gasto:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al eliminar el gasto",
        variant: "destructive"
      });
    }
  };

  // Formatear la fecha para mostrar
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
    } catch (error) {
      return dateString;
    }
  };

  // Obtener el nombre del vehículo
  const getVehicleName = (trip: TripWithFinancials) => {
    if (trip.vehicle) {
      return `${trip.vehicle.brand} ${trip.vehicle.model} (${trip.vehicle.plates})`;
    }
    return "No asignado";
  };

  // Obtener el nombre del conductor
  const getDriverName = (trip: TripWithFinancials) => {
    if (trip.driver) {
      return `${trip.driver.firstName} ${trip.driver.lastName}`;
    }
    return "No asignado";
  };

  // Obtener el color de badge para estado financiero
  const getProfitBadgeColor = (profit: number) => {
    if (profit > 0) return "success";
    if (profit < 0) return "destructive";
    return "secondary";
  };

  // Obtener el color para la cantidad de ventas
  const getSalesBadgeColor = (sales: number) => {
    if (sales > 3000) return "success";
    if (sales > 1000) return "secondary";
    return "default";
  };

  // Calcular el total de gastos actuales
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Historial de ventas</h1>
        <p className="text-muted-foreground">
          Consulta el historial financiero de todos los viajes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Viajes realizados</CardTitle>
          <CardDescription>
            Datos financieros de todos los viajes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrips ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg">Cargando datos financieros...</span>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center p-8">
              <p className="text-muted-foreground">No hay viajes con datos financieros disponibles</p>
            </div>
          ) : (
            <Table>
              <TableCaption>Lista de viajes con información financiera</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pasajeros</TableHead>
                  <TableHead>Venta boletos</TableHead>
                  <TableHead>Venta paquetería</TableHead>
                  <TableHead>Total ventas</TableHead>
                  <TableHead>Gastos</TableHead>
                  <TableHead>Ganancia</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.route.name}</TableCell>
                    <TableCell>{formatDate(trip.departureDate)}</TableCell>
                    <TableCell>{trip.passengerCount}/{trip.capacity}</TableCell>
                    <TableCell>
                      <Badge variant={getSalesBadgeColor(trip.ticketSales)}>
                        ${trip.ticketSales.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        ${trip.packageSales.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSalesBadgeColor(trip.totalSales)}>
                        ${trip.totalSales.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        ${trip.expenses.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getProfitBadgeColor(trip.profit)}>
                        ${trip.profit.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => loadTripDetails(trip.id)}
                          >
                            <EyeIcon className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Detalles financieros del viaje</DialogTitle>
                            <DialogDescription>
                              {trip.route.name} - {formatDate(trip.departureDate)}
                            </DialogDescription>
                          </DialogHeader>
                          
                          {isLoadingDetails ? (
                            <div className="flex justify-center items-center p-8">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="ml-2">Cargando detalles...</span>
                            </div>
                          ) : (
                            <Tabs defaultValue="summary">
                              <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="summary">Resumen</TabsTrigger>
                                <TabsTrigger value="passengers">Pasajeros ({passengers.length})</TabsTrigger>
                                <TabsTrigger value="packages">Paquetería ({packages.length})</TabsTrigger>
                                <TabsTrigger value="expenses">Gastos ({expenses.length})</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="summary">
                                <Card>
                                  <CardContent className="pt-6">
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                      <div>
                                        <h3 className="text-lg font-semibold mb-2">Información del viaje</h3>
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Ruta:</span>
                                            <span>{trip.route.name}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Fecha:</span>
                                            <span>{formatDate(trip.departureDate)}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Horario:</span>
                                            <span>{trip.departureTime} - {trip.arrivalTime}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Vehículo:</span>
                                            <span>{getVehicleName(trip)}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Conductor:</span>
                                            <span>{getDriverName(trip)}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Capacidad:</span>
                                            <span>{trip.passengerCount}/{trip.capacity} pasajeros</span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <h3 className="text-lg font-semibold mb-2">Resumen financiero</h3>
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Presupuesto:</span>
                                            <div className="flex items-center">
                                              <Input
                                                type="number"
                                                value={tripBudget}
                                                onChange={(e) => setTripBudget(parseFloat(e.target.value) || 0)}
                                                className="w-24 mr-2"
                                              />
                                              <Button 
                                                size="sm" 
                                                onClick={updateBudget}
                                                disabled={isUpdatingBudget}
                                              >
                                                {isUpdatingBudget ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : "Guardar"}
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Total ventas boletos:</span>
                                            <span className="font-medium">${trip.ticketSales.toFixed(2)}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Total ventas paquetería:</span>
                                            <span className="font-medium">${trip.packageSales.toFixed(2)}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Total ventas:</span>
                                            <span className="font-medium">${trip.totalSales.toFixed(2)}</span>
                                          </div>
                                          <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground">Total gastos:</span>
                                            <span className="font-medium">${totalExpenses.toFixed(2)}</span>
                                          </div>
                                          <div className="grid grid-cols-2 border-t pt-2 mt-2">
                                            <span className="text-muted-foreground font-medium">Ganancia:</span>
                                            <span className={`font-bold ${trip.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              ${trip.profit.toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </TabsContent>
                              
                              <TabsContent value="passengers">
                                <Card>
                                  <CardContent className="pt-6">
                                    {passengers.length === 0 ? (
                                      <div className="text-center p-4">
                                        <p className="text-muted-foreground">No hay pasajeros registrados para este viaje</p>
                                      </div>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Contacto</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Método</TableHead>
                                            <TableHead>Monto</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {passengers.map((passenger) => (
                                            <TableRow key={passenger.id}>
                                              <TableCell>{passenger.firstName} {passenger.lastName}</TableCell>
                                              <TableCell>
                                                <div className="flex flex-col">
                                                  {passenger.phone && <span>{passenger.phone}</span>}
                                                  {passenger.email && <span className="text-xs text-muted-foreground">{passenger.email}</span>}
                                                </div>
                                              </TableCell>
                                              <TableCell>
                                                <Badge variant={passenger.paymentStatus === "pagado" ? "success" : "default"}>
                                                  {passenger.paymentStatus === "pagado" ? "Pagado" : "Pendiente"}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>{passenger.paymentMethod || "N/A"}</TableCell>
                                              <TableCell>${passenger.paymentAmount?.toFixed(2) || "0.00"}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </CardContent>
                                </Card>
                              </TabsContent>
                              
                              <TabsContent value="packages">
                                <Card>
                                  <CardContent className="pt-6">
                                    {packages.length === 0 ? (
                                      <div className="text-center p-4">
                                        <p className="text-muted-foreground">No hay paquetes registrados para este viaje</p>
                                      </div>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Remitente</TableHead>
                                            <TableHead>Destinatario</TableHead>
                                            <TableHead>Peso</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Precio</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {packages.map((pkg) => (
                                            <TableRow key={pkg.id}>
                                              <TableCell className="font-medium">{pkg.trackingCode}</TableCell>
                                              <TableCell>{pkg.senderName}</TableCell>
                                              <TableCell>{pkg.recipientName}</TableCell>
                                              <TableCell>{pkg.weight} kg</TableCell>
                                              <TableCell>
                                                <Badge variant="secondary">
                                                  {pkg.status}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>${pkg.price.toFixed(2)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </CardContent>
                                </Card>
                              </TabsContent>
                              
                              <TabsContent value="expenses">
                                <Card>
                                  <CardContent className="pt-6">
                                    <div className="mb-4">
                                      <h3 className="text-lg font-semibold mb-2">Registrar nuevo gasto</h3>
                                      <div className="grid grid-cols-4 gap-4">
                                        <div className="col-span-1">
                                          <Label htmlFor="expenseAmount">Monto</Label>
                                          <Input
                                            id="expenseAmount"
                                            type="number"
                                            value={newExpense.amount}
                                            onChange={(e) => setNewExpense({
                                              ...newExpense,
                                              amount: parseFloat(e.target.value) || 0
                                            })}
                                          />
                                        </div>
                                        <div className="col-span-1">
                                          <Label htmlFor="expenseCategory">Categoría</Label>
                                          <Select
                                            value={newExpense.category}
                                            onValueChange={(value) => setNewExpense({
                                              ...newExpense,
                                              category: value
                                            })}
                                          >
                                            <SelectTrigger id="expenseCategory">
                                              <SelectValue placeholder="Seleccionar categoría" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="combustible">Combustible</SelectItem>
                                              <SelectItem value="casetas">Casetas</SelectItem>
                                              <SelectItem value="salarios">Salarios</SelectItem>
                                              <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                                              <SelectItem value="otros">Otros</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="col-span-1">
                                          <Label htmlFor="expenseDescription">Descripción</Label>
                                          <Input
                                            id="expenseDescription"
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({
                                              ...newExpense,
                                              description: e.target.value
                                            })}
                                          />
                                        </div>
                                        <div className="flex items-end">
                                          <Button 
                                            onClick={addExpense}
                                            disabled={isAddingExpense}
                                            className="w-full"
                                          >
                                            {isAddingExpense ? (
                                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                              <PlusCircleIcon className="h-4 w-4 mr-2" />
                                            )}
                                            Añadir gasto
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {expenses.length === 0 ? (
                                      <div className="text-center p-4">
                                        <p className="text-muted-foreground">No hay gastos registrados para este viaje</p>
                                      </div>
                                    ) : (
                                      <div>
                                        <h3 className="text-lg font-semibold mb-2">Gastos registrados</h3>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Categoría</TableHead>
                                              <TableHead>Descripción</TableHead>
                                              <TableHead>Fecha</TableHead>
                                              <TableHead>Monto</TableHead>
                                              <TableHead>Acciones</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {expenses.map((expense) => (
                                              <TableRow key={expense.id}>
                                                <TableCell className="capitalize">{expense.category}</TableCell>
                                                <TableCell>{expense.description || "-"}</TableCell>
                                                <TableCell>
                                                  {expense.createdAt ? formatDate(expense.createdAt.toString()) : "-"}
                                                </TableCell>
                                                <TableCell>${expense.amount.toFixed(2)}</TableCell>
                                                <TableCell>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteExpense(expense.id)}
                                                  >
                                                    <MinusCircleIcon className="h-4 w-4 mr-1 text-destructive" />
                                                    Eliminar
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                            <TableRow className="bg-secondary/20">
                                              <TableCell colSpan={3} className="text-right font-medium">
                                                Total:
                                              </TableCell>
                                              <TableCell className="font-bold">
                                                ${totalExpenses.toFixed(2)}
                                              </TableCell>
                                              <TableCell></TableCell>
                                            </TableRow>
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente principal de la página de historial de ventas
export default function SalesHistoryPage() {
  document.title = "Historial de ventas | BAMO";
  
  return (
    <DefaultLayout activeTab="sales-history">
      <SalesHistoryContent />
    </DefaultLayout>
  );
}