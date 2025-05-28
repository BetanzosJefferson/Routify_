import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Vehicle } from "@shared/schema";

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  
  // Estado del formulario
  const [form, setForm] = useState<{
    plates: string,
    brand: string,
    model: string,
    economicNumber: string,
    capacity: number,
    hasAC: boolean,
    hasRecliningSeats: boolean,
    services: string[],
    description: string
  }>({
    plates: "",
    brand: "",
    model: "",
    economicNumber: "",
    capacity: 0,
    hasAC: false,
    hasRecliningSeats: false,
    services: [],
    description: ""
  });
  
  // Estado para nuevo servicio que se va a agregar
  const [newService, setNewService] = useState("");
  
  // Para obtener todos los vehículos
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/vehicles");
        if (!res.ok) throw new Error("Error al cargar vehículos");
        return await res.json() as Vehicle[];
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        return [];
      }
    }
  });
  
  // Mutación para crear vehículo
  const createVehicleMutation = useMutation({
    mutationFn: async (vehicleData: Omit<Vehicle, "id" | "createdAt" | "updatedAt">) => {
      const res = await apiRequest("POST", "/api/vehicles", vehicleData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: "Vehículo creado",
        description: "El vehículo se ha creado correctamente.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Hubo un error al crear el vehículo.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para actualizar vehículo
  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Vehicle> }) => {
      const res = await apiRequest("PUT", `/api/vehicles/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setIsEditOpen(false);
      resetForm();
      toast({
        title: "Vehículo actualizado",
        description: "El vehículo se ha actualizado correctamente.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Hubo un error al actualizar el vehículo.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para eliminar vehículo
  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/vehicles/${id}`);
      // Código 204 (No Content) no devuelve JSON, así que no hay que parsearlo
      if (res.status === 204) {
        return { success: true };
      }
      // Para otros códigos, podemos intentar parsear la respuesta
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Vehículo eliminado",
        description: "El vehículo se ha eliminado correctamente.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Hubo un error al eliminar el vehículo.",
        variant: "destructive",
      });
    }
  });
  
  // Resetear formulario
  const resetForm = () => {
    setForm({
      plates: "",
      brand: "",
      model: "",
      economicNumber: "",
      capacity: 0,
      hasAC: false,
      hasRecliningSeats: false,
      services: [],
      description: ""
    });
    setNewService("");
  };
  
  // Cuando se abre el diálogo de edición
  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    
    // Convertimos hasAC y hasRecliningSeats a servicios para la visualización/edición
    const services = [...(vehicle.services || [])];
    
    // Solo agregamos estos servicios si están activos y no ya incluidos
    if (vehicle.hasAC && !services.includes("Aire acondicionado")) {
      services.push("Aire acondicionado");
    }
    
    if (vehicle.hasRecliningSeats && !services.includes("Asientos reclinables")) {
      services.push("Asientos reclinables");
    }
    
    setForm({
      plates: vehicle.plates,
      brand: vehicle.brand,
      model: vehicle.model,
      economicNumber: vehicle.economicNumber,
      capacity: vehicle.capacity,
      // Mantenemos estos valores para compatibilidad con vehículos existentes
      hasAC: vehicle.hasAC || false,
      hasRecliningSeats: vehicle.hasRecliningSeats || false,
      services: services,
      description: vehicle.description || ""
    });
    setIsEditOpen(true);
  };
  
  // Manejar cambios en campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === "capacity" ? parseInt(value) || 0 : value
    }));
  };
  
  // Manejar cambios en switches
  const handleSwitchChange = (checked: boolean, name: string) => {
    setForm(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  // Agregar servicio a la lista
  const handleAddService = () => {
    if (newService.trim()) {
      setForm(prev => ({
        ...prev,
        services: [...prev.services, newService.trim()]
      }));
      setNewService("");
    }
  };
  
  // Eliminar servicio de la lista
  const handleRemoveService = (index: number) => {
    setForm(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };
  
  // Enviar formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Procesamos los servicios para detectar si contienen "Aire acondicionado" o "Asientos reclinables"
    // y los convertimos a las propiedades hasAC y hasRecliningSeats
    const processedForm = {...form};
    
    // Ver si algún servicio debe convertirse a hasAC o hasRecliningSeats
    const airConditioningIndex = processedForm.services.findIndex(
      service => service.toLowerCase().includes("aire") || service.toLowerCase() === "ac"
    );
    if (airConditioningIndex !== -1) {
      processedForm.hasAC = true;
      // Eliminamos del array de servicios
      processedForm.services = [
        ...processedForm.services.slice(0, airConditioningIndex),
        ...processedForm.services.slice(airConditioningIndex + 1)
      ];
    }
    
    const recliningSeatsIndex = processedForm.services.findIndex(
      service => service.toLowerCase().includes("reclinable")
    );
    if (recliningSeatsIndex !== -1) {
      processedForm.hasRecliningSeats = true;
      // Eliminamos del array de servicios
      processedForm.services = [
        ...processedForm.services.slice(0, recliningSeatsIndex),
        ...processedForm.services.slice(recliningSeatsIndex + 1)
      ];
    }
    
    if (isEditOpen && selectedVehicle) {
      updateVehicleMutation.mutate({ 
        id: selectedVehicle.id, 
        data: processedForm 
      });
    } else {
      createVehicleMutation.mutate(processedForm);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Unidades</h1>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Agregar Unidad
        </Button>
      </div>
      
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          {/* Vista de escritorio - Tabla */}
          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Unidades</CardTitle>
                <CardDescription>
                  Visualiza y administra todas las unidades de transporte.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placas</TableHead>
                      <TableHead>Num. Económico</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Capacidad</TableHead>
                      <TableHead>Servicios</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles?.length ? (
                      vehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-medium">{vehicle.plates}</TableCell>
                          <TableCell>{vehicle.economicNumber}</TableCell>
                          <TableCell>{vehicle.brand}</TableCell>
                          <TableCell>{vehicle.model}</TableCell>
                          <TableCell>{vehicle.capacity} pasajeros</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {/* Combinamos todos los servicios, incluidos AC y asientos reclinables cuando existen */}
                              {vehicle.hasAC && (
                                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Aire acondicionado</span>
                              )}
                              {vehicle.hasRecliningSeats && (
                                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Asientos reclinables</span>
                              )}
                              {vehicle.services?.map((service, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                  {service}
                                </span>
                              ))}
                              {!vehicle.hasAC && !vehicle.hasRecliningSeats && (!vehicle.services || vehicle.services.length === 0) && (
                                <span className="text-gray-500 italic">Sin servicios</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(vehicle)}
                              className="mr-1"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deleteVehicleMutation.isPending && deleteVehicleMutation.variables === vehicle.id}
                              onClick={() => {
                                if (window.confirm("¿Estás seguro de eliminar esta unidad?")) {
                                  deleteVehicleMutation.mutate(vehicle.id);
                                }
                              }}
                            >
                              {deleteVehicleMutation.isPending && deleteVehicleMutation.variables === vehicle.id ? (
                                <svg className="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No hay unidades registradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Vista móvil - Tarjetas */}
          <div className="md:hidden space-y-4">
            {vehicles?.length ? (
              vehicles.map((vehicle) => (
                <Card key={vehicle.id} className="border border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div>
                            <div className="font-semibold text-gray-900">{vehicle.plates}</div>
                            <div className="text-sm text-gray-600">
                              {vehicle.brand} {vehicle.model}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(vehicle)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteVehicleMutation.isPending && deleteVehicleMutation.variables === vehicle.id}
                          onClick={() => {
                            if (window.confirm("¿Estás seguro de eliminar esta unidad?")) {
                              deleteVehicleMutation.mutate(vehicle.id);
                            }
                          }}
                          className="h-8 w-8"
                        >
                          {deleteVehicleMutation.isPending && deleteVehicleMutation.variables === vehicle.id ? (
                            <svg className="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Número Económico</span>
                        <span className="text-sm font-medium">{vehicle.economicNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Capacidad</span>
                        <span className="text-sm font-medium">{vehicle.capacity} pasajeros</span>
                      </div>
                      <div className="pt-2">
                        <span className="text-sm text-gray-600 block mb-2">Servicios</span>
                        <div className="flex flex-wrap gap-1">
                          {vehicle.hasAC && (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              Aire acondicionado
                            </span>
                          )}
                          {vehicle.hasRecliningSeats && (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              Asientos reclinables
                            </span>
                          )}
                          {vehicle.services?.map((service, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              {service}
                            </span>
                          ))}
                          {!vehicle.hasAC && !vehicle.hasRecliningSeats && (!vehicle.services || vehicle.services.length === 0) && (
                            <span className="text-gray-500 italic text-xs">Sin servicios adicionales</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border border-gray-200">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-center">
                    No hay unidades registradas.
                  </p>
                  <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Agregar Primera Unidad
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
      
      {/* Diálogo para crear/editar vehículo */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Nueva Unidad</DialogTitle>
            <DialogDescription>
              Completa el formulario para agregar una nueva unidad a la flota.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plates">Placas</Label>
                <Input
                  id="plates"
                  name="plates"
                  value={form.plates}
                  onChange={handleChange}
                  placeholder="ABC-123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="economicNumber">Número Económico</Label>
                <Input
                  id="economicNumber"
                  name="economicNumber"
                  value={form.economicNumber}
                  onChange={handleChange}
                  placeholder="ECO-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  placeholder="Mercedes-Benz"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  name="model"
                  value={form.model}
                  onChange={handleChange}
                  placeholder="Sprinter 2023"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  value={form.capacity}
                  onChange={handleChange}
                  min={0}
                  required
                />
              </div>
              
              {/* Quitamos los switches dedicados para que se añadan como servicios adicionales */}
              
              {/* Sección para agregar servicios adicionales */}
              <div className="col-span-2">
                <Label>Servicios adicionales</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Input
                    placeholder="Agregar servicio"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddService}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
                
                {/* Lista de servicios agregados */}
                {form.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.services.map((service, index) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 bg-muted rounded-full flex items-center"
                      >
                        <span className="text-sm">{service}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-1"
                          onClick={() => handleRemoveService(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Descripción opcional de la unidad..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createVehicleMutation.isPending}
              >
                {createVehicleMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : "Guardar Unidad"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para editar vehículo */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Unidad</DialogTitle>
            <DialogDescription>
              Actualiza la información de la unidad seleccionada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plates">Placas</Label>
                <Input
                  id="plates"
                  name="plates"
                  value={form.plates}
                  onChange={handleChange}
                  placeholder="ABC-123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="economicNumber">Número Económico</Label>
                <Input
                  id="economicNumber"
                  name="economicNumber"
                  value={form.economicNumber}
                  onChange={handleChange}
                  placeholder="ECO-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  placeholder="Mercedes-Benz"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  name="model"
                  value={form.model}
                  onChange={handleChange}
                  placeholder="Sprinter 2023"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  value={form.capacity}
                  onChange={handleChange}
                  min={0}
                  required
                />
              </div>
              
              {/* Quitamos los switches dedicados para que se manejen como servicios adicionales */}
              
              {/* Sección para agregar servicios adicionales */}
              <div className="col-span-2">
                <Label>Servicios adicionales</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Input
                    placeholder="Agregar servicio"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddService}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
                
                {/* Lista de servicios agregados */}
                {form.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.services.map((service, index) => (
                      <div 
                        key={index} 
                        className="px-3 py-1 bg-muted rounded-full flex items-center"
                      >
                        <span className="text-sm">{service}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-1"
                          onClick={() => handleRemoveService(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Descripción opcional de la unidad..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateVehicleMutation.isPending}
              >
                {updateVehicleMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Actualizando...
                  </>
                ) : "Actualizar Unidad"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VehiclesPage;