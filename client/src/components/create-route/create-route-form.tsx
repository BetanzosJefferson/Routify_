import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MapIcon, MapPinIcon, PlusCircleIcon, XCircleIcon } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocationPicker } from "@/components/ui/location-picker";
import { createRouteValidationSchema, InsertRoute } from "@shared/schema";

type StopData = {
  id: string;
  location: string;
  stateCode?: string;
  municipalityCode?: string;
  stationName?: string;
};

interface CreateRouteFormProps {
  initialRoute?: any; // Ruta inicial para edición, null si es una nueva ruta
  onSuccess?: () => void; // Callback después de guardar con éxito
}

export function CreateRouteForm({ initialRoute, onSuccess }: CreateRouteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stops, setStops] = useState<StopData[]>([]);

  // Form validation and handling
  const form = useForm<InsertRoute>({
    resolver: zodResolver(createRouteValidationSchema),
    defaultValues: initialRoute || {
      name: "",
      stops: []
    },
  });
  
  // Initialize stops from initialRoute if provided
  useEffect(() => {
    if (initialRoute) {
      let allStops = [];
      
      // Primero agregamos el origen como primera parada
      if (initialRoute.origin) {
        allStops.push({
          id: `stop-origin`,
          location: initialRoute.origin,
        });
      }
      
      // Luego agregamos las paradas intermedias
      if (initialRoute.stops && initialRoute.stops.length > 0) {
        const middleStops = initialRoute.stops.map((stop: string, index: number) => ({
          id: `stop-${index}`,
          location: stop,
        }));
        allStops = [...allStops, ...middleStops];
      }
      
      // Finalmente agregamos el destino como última parada
      if (initialRoute.destination) {
        allStops.push({
          id: `stop-destination`,
          location: initialRoute.destination,
        });
      }
      
      if (allStops.length > 0) {
        console.log("Inicializando todas las paradas de la ruta:", allStops);
        setStops(allStops);
      }
    }
  }, [initialRoute]);

  // Generate a route name based on the first and last stops
  const generateRouteName = (stopsList: StopData[]) => {
    if (stopsList.length < 2) return "";
    const firstStop = stopsList[0].location.split(',')[0].trim();
    const lastStop = stopsList[stopsList.length - 1].location.split(',')[0].trim();
    return `${firstStop} - ${lastStop}`;
  };

  // Add a new stop
  const handleAddLocation = (locationData: any) => {
    const newStop: StopData = {
      id: `stop-${Date.now()}`,
      location: locationData.fullName,
      stateCode: locationData.stateCode,
      municipalityCode: locationData.municipalityCode,
      stationName: locationData.stationName
    };
    
    const updatedStops = [...stops, newStop];
    setStops(updatedStops);
    
    form.setValue("stops", updatedStops.map(stop => stop.location));
    
    // Auto-generate route name if it's empty or matches previous auto-generated name
    const currentName = form.getValues("name");
    const previousName = generateRouteName(stops);
    
    if (!currentName || currentName === previousName) {
      const newName = generateRouteName(updatedStops);
      form.setValue("name", newName);
    }
  };

  // Remove a stop
  const handleRemoveStop = (id: string) => {
    const updatedStops = stops.filter((stop) => stop.id !== id);
    setStops(updatedStops);
    form.setValue("stops", updatedStops.map(stop => stop.location));
  };

  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(stops);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setStops(items);
    form.setValue("stops", items.map(stop => stop.location));
  };

  // Mutation for creating or updating routes
  const routeMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      console.log("Enviando datos a servidor:", data);
      
      // Verificar la existencia de datos requeridos
      if (!data.name || !data.origin || !data.destination) {
        console.error("Datos requeridos faltantes:", { name: data.name, origin: data.origin, destination: data.destination });
        throw new Error("Faltan datos requeridos (nombre, origen, destino)");
      }
      
      try {
        if (initialRoute && initialRoute.id) {
          // Update existing route
          console.log("Actualizando ruta existente:", initialRoute.id);
          const result = await fetch(`/api/routes/${initialRoute.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          console.log("Respuesta raw:", result);
          return result.json();
        } else {
          // Create new route
          console.log("Creando nueva ruta...");
          const result = await fetch('/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          console.log("Respuesta raw:", result);
          if (!result.ok) {
            const errorText = await result.text();
            throw new Error(errorText || result.statusText);
          }
          return result.json();
        }
      } catch (error) {
        console.error("Error en la petición:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: initialRoute ? "Ruta actualizada" : "Ruta creada exitosamente",
        description: initialRoute 
          ? "La ruta ha sido actualizada correctamente." 
          : "La nueva ruta ha sido creada y ya está disponible para publicar viajes.",
      });
      
      // Reset form and stops if not editing
      if (!initialRoute) {
        form.reset();
        setStops([]);
      }
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Invalidate routes cache
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
    },
    onError: (error) => {
      toast({
        title: "Error al crear la ruta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: InsertRoute) => {
    // Validar que haya al menos 2 paradas
    if (stops.length < 2) {
      toast({
        title: "Error de validación",
        description: "Una ruta debe tener al menos origen y destino.",
        variant: "destructive",
      });
      return;
    }
    
    // Asegurarse de que hay al menos 2 paradas para establecer origen y destino
    const stopLocations = stops.map(stop => stop.location);
    
    // Extraer el primer y último elemento para origen y destino
    const origin = stopLocations[0];
    const destination = stopLocations[stopLocations.length - 1];
    
    // Si hay más de 2 paradas, las del medio son las "stops"
    // Si solo hay 2 paradas, el array de stops debe estar vacío
    const middleStops = stopLocations.length > 2 
      ? stopLocations.slice(1, stopLocations.length - 1) 
      : [];
    
    console.log("Procesando paradas:", { 
      origin, 
      middleStops, 
      destination, 
      totalStops: stops.length 
    });
    
    // Combinar los datos del formulario con las paradas
    const routeData: InsertRoute = {
      ...data,
      stops: middleStops,
      origin: origin,
      destination: destination
    };
    
    console.log("Enviando datos de ruta (procesados):", routeData);
    
    routeMutation.mutate(routeData);
  };

  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <MapIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">{initialRoute ? "Editar Ruta" : "Crear Ruta"}</h2>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form 
              onSubmit={(e) => {
                console.log("Formulario enviado");
                form.handleSubmit(onSubmit)(e);
              }} 
              className="space-y-6">
              {/* Route Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la ruta</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Ciudad de México - Acapulco" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stops */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <FormLabel>Paradas</FormLabel>
                  <LocationPicker onLocationAdded={handleAddLocation} />
                </div>
                
                {stops.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-md p-8 text-center">
                    <p className="text-gray-500 mb-2">
                      Agrega al menos dos ubicaciones para crear una ruta
                    </p>
                    <LocationPicker 
                      onLocationAdded={handleAddLocation} 
                      buttonText="Agregar primera ubicación"
                      className="mt-2"
                    />
                  </div>
                )}
                
                {stops.length > 0 && (
                  <div className="border rounded-md p-2 mb-4">
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="stops">
                        {(provided) => (
                          <ul
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-1"
                          >
                            {stops.map((stop, index) => (
                              <Draggable key={stop.id} draggableId={stop.id} index={index}>
                                {(provided) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md border"
                                  >
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 mr-3">
                                        <div className="rounded-full bg-primary w-8 h-8 flex items-center justify-center text-white font-semibold text-sm">
                                          {index + 1}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-700">{stop.location}</p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveStop(stop.id)}
                                    >
                                      <XCircleIcon className="h-5 w-5 text-red-500" />
                                    </Button>
                                  </li>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                )}
              </div>

              {/* Submit Button - Reemplazado con implementación directa */}
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors duration-200"
                  disabled={routeMutation.isPending || stops.length < 2}
                  onClick={() => {
                    if (stops.length < 2) {
                      toast({
                        title: "Error de validación",
                        description: "Una ruta debe tener al menos origen y destino.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Obtener datos del formulario manualmente
                    const formData = form.getValues();
                    
                    // Extraer paradas
                    const stopLocations = stops.map(stop => stop.location);
                    
                    // Verificamos que haya al menos 2 paradas para origen y destino
                    if (stopLocations.length < 2) {
                      toast({
                        title: "Error de validación",
                        description: "Una ruta debe tener al menos origen y destino",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    const origin = stopLocations[0];
                    const destination = stopLocations[stopLocations.length - 1];
                    const middleStops = stopLocations.length > 2 
                      ? stopLocations.slice(1, stopLocations.length - 1) 
                      : [];
                    
                    // Crear objeto de datos
                    const routeData = {
                      name: formData.name,
                      origin: origin,
                      destination: destination,
                      stops: middleStops
                    };
                    
                    console.log("Datos de ruta a enviar:", routeData);
                    
                    // Determinar el método y URL según si es edición o creación
                    const url = initialRoute 
                      ? `/api/routes/${initialRoute.id}` 
                      : '/api/routes';
                    
                    const method = initialRoute ? 'PUT' : 'POST';
                    
                    // Hacer petición directa con fetch
                    fetch(url, {
                      method: method,
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(routeData)
                    })
                    .then(response => {
                      console.log("Respuesta del servidor:", response);
                      if (!response.ok) {
                        return response.text().then(text => {
                          throw new Error(text || response.statusText);
                        });
                      }
                      return response.json();
                    })
                    .then(data => {
                      console.log("Operación exitosa:", data);
                      toast({
                        title: initialRoute ? "Ruta actualizada exitosamente" : "Ruta creada exitosamente",
                        description: initialRoute 
                          ? "La ruta ha sido actualizada correctamente." 
                          : "La nueva ruta ha sido creada y ya está disponible para publicar viajes.",
                      });
                      
                      // Limpiar formulario
                      form.reset();
                      setStops([]);
                      
                      // Invalidar cache
                      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
                      
                      // Llamar al callback si existe
                      if (onSuccess) onSuccess();
                    })
                    .catch(error => {
                      console.error("Error al crear ruta:", error);
                      toast({
                        title: "Error al crear la ruta",
                        description: error.message,
                        variant: "destructive",
                      });
                    });
                  }}
                >
                  {routeMutation.isPending ? 
                    (initialRoute ? "Actualizando..." : "Creando...") : 
                    (initialRoute ? "Actualizar Ruta" : "Crear Ruta")}
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}