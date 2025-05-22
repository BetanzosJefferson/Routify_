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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipos de datos
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
  document.title = "Historial de ventas | BAMO";
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
    category: "",
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
    if (tripsData) {
      // Ordenar viajes por fecha, del más reciente al más antiguo
      const sortedTrips = [...tripsData].sort((a, b) => {
        return new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime();
      });
      
      setTrips(sortedTrips);
    }
  }, [tripsData]);

  // Función para cargar los detalles de un viaje
  const loadTripDetails = async (tripId: number) => {
    setIsLoadingDetails(true);
    setSelectedTripId(tripId);

    try {
      // Cargar pasajeros
      const passengersResponse = await apiRequest(`/api/trips/${tripId}/passengers`);
      setPassengers(passengersResponse || []);

      // Cargar paqueterías
      const packagesResponse = await apiRequest(`/api/trips/${tripId}/packages`);
      setPackages(packagesResponse || []);

      // Cargar gastos
      const expensesResponse = await apiRequest(`/api/trips/${tripId}/expenses`);
      setExpenses(expensesResponse.map((expense: any) => ({
        ...expense,
        category: expense.type || expense.category // Asegurar compatibilidad
      })) || []);

      // Cargar presupuesto
      const budgetResponse = await apiRequest(`/api/trips/${tripId}/budget`);
      setTripBudget(budgetResponse?.amount || 0);
    } catch (error) {
      console.error("Error al cargar detalles del viaje:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del viaje",
        variant: "destructive"
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Función para actualizar el presupuesto
  const updateBudget = async () => {
    if (!selectedTripId) return;
    
    setIsUpdatingBudget(true);
    try {
      await apiRequest(`/api/trips/${selectedTripId}/budget`, {
        method: "POST",
        data: { amount: tripBudget }
      });
      
      toast({
        title: "Presupuesto actualizado",
        description: "El presupuesto ha sido actualizado correctamente",
      });
      
      // Actualizar la lista de viajes con el nuevo presupuesto
      refetchTrips();
    } catch (error) {
      console.error("Error al actualizar el presupuesto:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el presupuesto",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingBudget(false);
    }
  };

  // Función para agregar un nuevo gasto
  const addExpense = async () => {
    if (!selectedTripId || newExpense.amount <= 0 || !newExpense.category) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete los campos requeridos",
        variant: "destructive"
      });
      return;
    }
    
    setIsAddingExpense(true);
    try {
      // Adaptar el payload para la API (type en lugar de category)
      const expenseData = {
        tripId: selectedTripId,
        amount: newExpense.amount,
        type: newExpense.category,
        description: newExpense.description || ""
      };
      
      await apiRequest(`/api/trips/${selectedTripId}/expenses`, {
        method: "POST",
        data: expenseData
      });
      
      // Recargar los gastos
      const expensesResponse = await apiRequest(`/api/trips/${selectedTripId}/expenses`);
      setExpenses(expensesResponse.map((expense: any) => ({
        ...expense,
        category: expense.type || expense.category
      })) || []);
      
      // Limpiar el formulario
      setNewExpense({
        amount: 0,
        category: "",
        description: ""
      });
      
      toast({
        title: "Gasto registrado",
        description: "El gasto ha sido registrado correctamente",
      });
      
      // Actualizar la lista de viajes
      refetchTrips();
    } catch (error) {
      console.error("Error al agregar el gasto:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar el gasto",
        variant: "destructive"
      });
    } finally {
      setIsAddingExpense(false);
    }
  };

  // Función para eliminar un gasto
  const deleteExpense = async (expenseId: number) => {
    if (!selectedTripId) return;
    
    try {
      // Usar la ruta simplificada para eliminar gastos
      await apiRequest(`/api/trips/expenses/remove`, {
        method: "POST",
        data: { expenseId }
      });
      
      // Eliminar el gasto de la lista local
      setExpenses(expenses.filter(expense => expense.id !== expenseId));
      
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado correctamente",
      });
      
      // Actualizar la lista de viajes
      refetchTrips();
    } catch (error) {
      console.error("Error al eliminar el gasto:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto",
        variant: "destructive"
      });
    }
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch (e) {
      return dateString;
    }
  };

  // Calcular el total de gastos actuales
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  console.log("Datos de viajes recibidos:", tripsData);

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
            Listado de todos los viajes ordenados por fecha (más recientes primero)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrips ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando viajes...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Pasajeros</TableHead>
                  <TableHead>Venta Boletos</TableHead>
                  <TableHead>Paqueterías</TableHead>
                  <TableHead>Venta Paqueterías</TableHead>
                  <TableHead>Total Ventas</TableHead>
                  <TableHead>Egresos</TableHead>
                  <TableHead>Ganancia</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8">
                      No hay viajes para mostrar
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>{formatDate(trip.departureDate)}</TableCell>
                      <TableCell>{trip.route.name}</TableCell>
                      <TableCell>{trip.departureTime} - {trip.arrivalTime}</TableCell>
                      <TableCell>
                        {trip.vehicle ? `${trip.vehicle.brand} ${trip.vehicle.model} (${trip.vehicle.plates})` : 'No asignada'}
                      </TableCell>
                      <TableCell>
                        {trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : 'No asignado'}
                      </TableCell>
                      <TableCell className="text-center">{trip.passengerCount}</TableCell>
                      <TableCell className="font-medium">${trip.ticketSales.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{trip.packageCount}</TableCell>
                      <TableCell className="font-medium">${trip.packageSales.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">${trip.totalSales.toFixed(2)}</TableCell>
                      <TableCell className="font-medium text-destructive">${trip.expenses.toFixed(2)}</TableCell>
                      <TableCell className={`font-medium ${trip.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${trip.profit.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => loadTripDetails(trip.id)}
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Detalles del viaje</DialogTitle>
                              <DialogDescription>
                                {trip.route.name} - {formatDate(trip.departureDate)} ({trip.departureTime} - {trip.arrivalTime})
                              </DialogDescription>
                            </DialogHeader>
                            
                            {isLoadingDetails ? (
                              <div className="flex justify-center items-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-2">Cargando detalles...</span>
                              </div>
                            ) : (
                              <Tabs defaultValue="passengers">
                                <TabsList className="w-full">
                                  <TabsTrigger value="passengers">Pasajeros</TabsTrigger>
                                  <TabsTrigger value="packages">Paqueterías</TabsTrigger>
                                  <TabsTrigger value="expenses">Gastos</TabsTrigger>
                                  <TabsTrigger value="budget">Presupuesto</TabsTrigger>
                                </TabsList>
                                
                                {/* Pestaña de Pasajeros */}
                                <TabsContent value="passengers">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Contacto</TableHead>
                                        <TableHead>Estado de pago</TableHead>
                                        <TableHead>Monto</TableHead>
                                        <TableHead>Método</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {passengers.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={5} className="text-center py-4">
                                            No hay pasajeros registrados
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        passengers.map((passenger) => (
                                          <TableRow key={passenger.id}>
                                            <TableCell>{passenger.firstName} {passenger.lastName}</TableCell>
                                            <TableCell>
                                              {passenger.phone && <div>{passenger.phone}</div>}
                                              {passenger.email && <div className="text-sm text-gray-500">{passenger.email}</div>}
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant={passenger.paymentStatus === 'paid' ? 'success' : 'secondary'}>
                                                {passenger.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>${passenger.paymentAmount?.toFixed(2) || '0.00'}</TableCell>
                                            <TableCell>{passenger.paymentMethod || 'No especificado'}</TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </TableBody>
                                  </Table>
                                </TabsContent>
                                
                                {/* Pestaña de Paqueterías */}
                                <TabsContent value="packages">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Remitente</TableHead>
                                        <TableHead>Destinatario</TableHead>
                                        <TableHead>Peso</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead>Estado</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {packages.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={7} className="text-center py-4">
                                            No hay paqueterías registradas
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        packages.map((pkg) => (
                                          <TableRow key={pkg.id}>
                                            <TableCell>{pkg.trackingCode}</TableCell>
                                            <TableCell>{pkg.senderName}</TableCell>
                                            <TableCell>{pkg.recipientName}</TableCell>
                                            <TableCell>{pkg.weight} kg</TableCell>
                                            <TableCell>{pkg.description || 'No especificado'}</TableCell>
                                            <TableCell>${pkg.price.toFixed(2)}</TableCell>
                                            <TableCell>
                                              <Badge variant={
                                                pkg.status === 'entregado' ? 'success' : 
                                                pkg.status === 'en_transito' ? 'default' : 'secondary'
                                              }>
                                                {pkg.status === 'entregado' ? 'Entregado' : 
                                                pkg.status === 'en_transito' ? 'En tránsito' : 'Pendiente'}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      )}
                                    </TableBody>
                                  </Table>
                                </TabsContent>
                                
                                {/* Pestaña de Gastos */}
                                <TabsContent value="expenses">
                                  <div className="space-y-4">
                                    {/* Formulario para agregar gasto */}
                                    <Card>
                                      <CardHeader className="pb-3">
                                        <CardTitle>Registrar nuevo gasto</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="grid grid-cols-12 gap-4">
                                          <div className="col-span-3">
                                            <Label htmlFor="amount">Monto</Label>
                                            <Input
                                              id="amount"
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={newExpense.amount}
                                              onChange={(e) => setNewExpense({
                                                ...newExpense,
                                                amount: parseFloat(e.target.value) || 0
                                              })}
                                            />
                                          </div>
                                          <div className="col-span-3">
                                            <Label htmlFor="category">Categoría</Label>
                                            <Select
                                              value={newExpense.category}
                                              onValueChange={(value) => setNewExpense({
                                                ...newExpense,
                                                category: value
                                              })}
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="combustible">Combustible</SelectItem>
                                                <SelectItem value="casetas">Casetas</SelectItem>
                                                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                                                <SelectItem value="alimentacion">Alimentación</SelectItem>
                                                <SelectItem value="salario">Salario</SelectItem>
                                                <SelectItem value="otro">Otro</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="col-span-4">
                                            <Label htmlFor="description">Descripción (Opcional)</Label>
                                            <Input
                                              id="description"
                                              value={newExpense.description}
                                              onChange={(e) => setNewExpense({
                                                ...newExpense,
                                                description: e.target.value
                                              })}
                                            />
                                          </div>
                                          <div className="col-span-2 flex items-end">
                                            <Button 
                                              className="w-full" 
                                              onClick={addExpense}
                                              disabled={isAddingExpense}
                                            >
                                              {isAddingExpense ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                              ) : (
                                                <PlusCircleIcon className="h-4 w-4 mr-2" />
                                              )}
                                              Agregar
                                            </Button>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                    
                                    {/* Lista de gastos */}
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Categoría</TableHead>
                                          <TableHead>Descripción</TableHead>
                                          <TableHead>Monto</TableHead>
                                          <TableHead></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {expenses.length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={4} className="text-center py-4">
                                              No hay gastos registrados
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          expenses.map((expense) => (
                                            <TableRow key={expense.id}>
                                              <TableCell className="capitalize">
                                                {expense.category === 'combustible' ? 'Combustible' :
                                                expense.category === 'casetas' ? 'Casetas' :
                                                expense.category === 'mantenimiento' ? 'Mantenimiento' :
                                                expense.category === 'alimentacion' ? 'Alimentación' :
                                                expense.category === 'salario' ? 'Salario' :
                                                expense.category === 'otro' ? 'Otro' :
                                                expense.category}
                                              </TableCell>
                                              <TableCell>{expense.description || 'No especificado'}</TableCell>
                                              <TableCell className="font-medium">${expense.amount.toFixed(2)}</TableCell>
                                              <TableCell>
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon"
                                                  onClick={() => deleteExpense(expense.id)}
                                                >
                                                  <MinusCircleIcon className="h-4 w-4 text-destructive" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          ))
                                        )}
                                        {expenses.length > 0 && (
                                          <TableRow>
                                            <TableCell colSpan={2} className="text-right font-bold">Total:</TableCell>
                                            <TableCell className="font-bold">${totalExpenses.toFixed(2)}</TableCell>
                                            <TableCell></TableCell>
                                          </TableRow>
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TabsContent>
                                
                                {/* Pestaña de Presupuesto */}
                                <TabsContent value="budget">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle>Presupuesto del operador</CardTitle>
                                      <CardDescription>
                                        Establece el presupuesto asignado para este viaje
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="budget">Monto del presupuesto</Label>
                                          <Input
                                            id="budget"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={tripBudget}
                                            onChange={(e) => setTripBudget(parseFloat(e.target.value) || 0)}
                                          />
                                        </div>
                                        <div className="flex items-end">
                                          <Button 
                                            onClick={updateBudget}
                                            disabled={isUpdatingBudget}
                                          >
                                            {isUpdatingBudget ? (
                                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : null}
                                            Guardar presupuesto
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-6 p-4 border rounded-md bg-gray-50">
                                        <h3 className="text-lg font-medium mb-2">Resumen financiero</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-sm text-gray-500">Presupuesto asignado</p>
                                            <p className="text-lg font-bold">${tripBudget.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm text-gray-500">Gastos totales</p>
                                            <p className="text-lg font-bold text-destructive">${totalExpenses.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm text-gray-500">Diferencia</p>
                                            <p className={`text-lg font-bold ${(tripBudget - totalExpenses) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              ${(tripBudget - totalExpenses).toFixed(2)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </TabsContent>
                              </Tabs>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}