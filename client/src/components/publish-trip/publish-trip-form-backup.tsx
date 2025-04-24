import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClockIcon, CalendarIcon, InfoIcon, Loader2Icon, CalendarPlusIcon, XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { TimeInput } from "@/components/ui/time-input";
import { publishTripValidationSchema, type Route, type RouteWithSegments, type SegmentPrice } from "@shared/schema";
import { generateSegmentsFromRoute, convertTo24Hour, isSameCity } from "@/lib/utils";
import TripList from "./trip-list";

type StopTime = {
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
  location: string;
};

// Extendiendo SegmentPrice para incluir tiempos
// Redefinir SegmentTimePrice para incluir formatos de tiempo alternativos
interface SegmentTimeFields {
  departureHour: string;
  departureMinute: string;
  departureAmPm: "AM" | "PM";
  arrivalHour: string;
  arrivalMinute: string;
  arrivalAmPm: "AM" | "PM";
  // Formato simplificado para enviar al backend
  departureTime?: string;
  arrivalTime?: string;
}

type SegmentTimePrice = SegmentPrice & SegmentTimeFields;

type FormValues = {
  routeId: number;
  startDate: string;
  endDate: string;
  departureHour: string;
  departureMinute: string;
  departureAmPm: "AM" | "PM";
  arrivalHour: string;
  arrivalMinute: string;
  arrivalAmPm: "AM" | "PM";
  capacity: number;
  availableSeats?: number; // Agregado para inicializar asientos disponibles
  price: number;
  vehicleType: string;
  segmentPrices: SegmentTimePrice[];
  stopTimes?: StopTime[]; // Agregar tiempos de paradas intermedias
};

export function PublishTripForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [segmentPrices, setSegmentPrices] = useState<SegmentTimePrice[]>([]);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [stopTimes, setStopTimes] = useState<Array<{hour: string, minute: string, ampm: "AM" | "PM", location?: string} | null>>([]);
  const [currentStopInfo, setCurrentStopInfo] = useState<{name: string, location: string}>({name: "", location: ""});
  const [editingSegment, setEditingSegment] = useState<{index: number, timeType: 'departure' | 'arrival'} | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState<number | null>(null);
  const [editingTimeValue, setEditingTimeValue] = useState<{hour: string, minute: string, ampm: "AM" | "PM"}>({
    hour: "08",
    minute: "00",
    ampm: "AM"
  });

  // Fetch routes for dropdown
  const routesQuery = useQuery({
    queryKey: ["/api/routes"],
    placeholderData: [],
    // Aseguramos que se haga la consulta real a la API
    enabled: true,
    // Funciones personalizadas para la consulta
    queryFn: async () => {
      console.log("Cargando rutas para formulario...");
      const response = await fetch("/api/routes");
      if (!response.ok) {
        throw new Error("Error al cargar las rutas");
      }
      const data = await response.json();
      console.log("Rutas cargadas para formulario:", data);
      return data;
    },
    // Reintentamos la consulta automáticamente si falla
    retry: 3,
    retryDelay: 1000,
  });

  // Fetch selected route segments when route changes
  const routeSegmentsQuery = useQuery({
    queryKey: ["/api/routes", selectedRouteId, "segments"],
    queryFn: async () => {
      if (!selectedRouteId) return null;
      const res = await fetch(`/api/routes/${selectedRouteId}/segments`);
      return await res.json() as RouteWithSegments;
    },
    enabled: !!selectedRouteId,
  });

  // Form validation and handling
  const form = useForm<FormValues>({
    resolver: zodResolver(publishTripValidationSchema),
    defaultValues: {
      routeId: 0,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      departureHour: "08",
      departureMinute: "00",
      departureAmPm: "AM",
      arrivalHour: "12",
      arrivalMinute: "00",
      arrivalAmPm: "PM",
      capacity: 18,
      price: 450,
      vehicleType: "standard",
      segmentPrices: [],
    },
  });

  // Update segment prices when route changes
  useEffect(() => {
    if (routeSegmentsQuery.data) {
      const route = routeSegmentsQuery.data;
      
      // Verificar que route.segments existe antes de usar filter
      if (route.segments && Array.isArray(route.segments)) {
        const segments = route.segments.filter(
          segment => segment && segment.origin && segment.destination && 
          !isSameCity(segment.origin, segment.destination)
        );
        
        const segmentPricesWithDefaultValues = segments.map(segment => ({
          origin: segment.origin,
          destination: segment.destination,
          price: 0,
          // Añadir campos de tiempo para cada segmento
          departureHour: "08",
          departureMinute: "00",
          departureAmPm: "AM" as "AM", 
          arrivalHour: "09",
          arrivalMinute: "00",
          arrivalAmPm: "AM" as "AM"
        }));
        
        setSegmentPrices(segmentPricesWithDefaultValues);
        form.setValue("segmentPrices", segmentPricesWithDefaultValues);
      } else {
        console.warn("No se encontraron segmentos en la ruta seleccionada o la estructura es incorrecta", route);
        setSegmentPrices([]);
        form.setValue("segmentPrices", []);
      }
    }
  }, [routeSegmentsQuery.data, form]);

  // Handle route selection
  const handleRouteChange = (routeId: string) => {
    const id = parseInt(routeId, 10);
    setSelectedRouteId(id);
    form.setValue("routeId", id);
  };

  // Handle segment price updates
  const updateSegmentPrice = (index: number, price: number) => {
    const updatedPrices = [...segmentPrices];
    updatedPrices[index] = {
      ...updatedPrices[index],
      price,
    };
    setSegmentPrices(updatedPrices);
    form.setValue("segmentPrices", updatedPrices);
  };
  
  // Manejador para actualizar el tiempo de salida/llegada de un segmento
  const updateSegmentTime = (index: number, timeType: 'departure' | 'arrival', field: 'hour' | 'minute' | 'ampm', value: string) => {
    const updatedPrices = [...segmentPrices];
    if (timeType === 'departure') {
      updatedPrices[index] = {
        ...updatedPrices[index],
        [`departure${field.charAt(0).toUpperCase() + field.slice(1)}`]: value,
      };
    } else {
      updatedPrices[index] = {
        ...updatedPrices[index],
        [`arrival${field.charAt(0).toUpperCase() + field.slice(1)}`]: value,
      };
    }
    setSegmentPrices(updatedPrices);
    form.setValue("segmentPrices", updatedPrices);
  };
  
  // Initialize the time arrays when the route is selected
  useEffect(() => {
    if (routeSegmentsQuery.data) {
      // Crear un array con el origen, las paradas y el destino
      const allLocations = [
        routeSegmentsQuery.data.origin,
        ...(routeSegmentsQuery.data.stops || []),
        routeSegmentsQuery.data.destination
      ];
      const totalStops = allLocations.length;
      
      // Inicializar tiempos para cada parada
      const initialTimes = Array(totalStops).fill(null);
      
      // Tiempo de origen (salida)
      initialTimes[0] = {
        hour: form.getValues('departureHour'),
        minute: form.getValues('departureMinute'),
        ampm: form.getValues('departureAmPm'),
        location: allLocations[0] || ""
      };
      
      // Tiempo de destino (llegada)
      initialTimes[initialTimes.length - 1] = {
        hour: form.getValues('arrivalHour'),
        minute: form.getValues('arrivalMinute'),
        ampm: form.getValues('arrivalAmPm'),
        location: allLocations[allLocations.length - 1] || ""
      };
      
      // Inicializar tiempos intermedios proporcionalmente
      if (totalStops > 2) {
        for (let i = 1; i < totalStops - 1; i++) {
          // Para paradas intermedias, creamos tiempos proporcionales
          initialTimes[i] = {
            hour: "00",
            minute: "00",
            ampm: "AM",
            location: allLocations[i] || ""
          };
        }
      }
      
      setStopTimes(initialTimes);
    }
  }, [routeSegmentsQuery.data, form]);

  // Handle opening the time editor dialog
  const handleEditTime = (stopIndex: number) => {
    if (!routeSegmentsQuery.data) return;
    
    setEditingStopIndex(stopIndex);
    
    // Determinar la información de la parada actual
    let stopName = "";
    let stopLocation = "";
    
    if (stopIndex === 0) {
      // Es el origen
      stopName = "Terminal Principal";
      stopLocation = routeSegmentsQuery.data.origin || "Origen";
    } else if (stopIndex === (routeSegmentsQuery.data.stops?.length || 0) + 1) {
      // Es el destino final
      stopName = "Destino Final";
      stopLocation = routeSegmentsQuery.data.destination || "Destino";
    } else if (routeSegmentsQuery.data.stops && routeSegmentsQuery.data.stops[stopIndex - 1]) {
      // Es una parada intermedia
      stopName = `Parada ${stopIndex}`;
      stopLocation = routeSegmentsQuery.data.stops[stopIndex - 1];
    }
    
    setCurrentStopInfo({
      name: stopName,
      location: stopLocation
    });
    
    setShowTimeDialog(true);
  };
  
  // Guardar el tiempo editado
  const saveStopTime = (hour: string, minute: string, ampm: "AM" | "PM") => {
    console.log("Guardando tiempo de parada...", editingStopIndex, `${hour}:${minute} ${ampm}`);
    
    if (editingStopIndex === null) return;
    
    // Obtener la ubicación para este índice
    let stopLocation = "";
    if (routeSegmentsQuery.data) {
      const allLocations = [
        routeSegmentsQuery.data.origin,
        ...(routeSegmentsQuery.data.stops || []),
        routeSegmentsQuery.data.destination
      ];
      stopLocation = allLocations[editingStopIndex] || "";
    }
    
    console.log("Parada:", stopLocation, "Índice:", editingStopIndex);
    
    // Actualizar el array de tiempos, incluyendo la ubicación
    const newStopTimes = [...stopTimes];
    newStopTimes[editingStopIndex] = { 
      hour, 
      minute, 
      ampm,
      location: stopLocation
    };
    setStopTimes(newStopTimes);
    
    console.log("Tiempos actualizados:", newStopTimes);
    
    // Si es el origen o el destino, actualizar los valores del formulario
    let allLocationsLength = 0;
    if (routeSegmentsQuery.data) {
      allLocationsLength = [
        routeSegmentsQuery.data.origin,
        ...(routeSegmentsQuery.data.stops || []),
        routeSegmentsQuery.data.destination
      ].length;
    }
    
    if (editingStopIndex === 0) {
      // Origen
      console.log("Actualizando tiempos de origen en el formulario");
      form.setValue('departureHour', hour);
      form.setValue('departureMinute', minute);
      form.setValue('departureAmPm', ampm);
    } else if (editingStopIndex === allLocationsLength - 1) {
      // Destino - uso de allLocationsLength para ser consistente
      console.log("Actualizando tiempos de destino en el formulario");
      form.setValue('arrivalHour', hour);
      form.setValue('arrivalMinute', minute);
      form.setValue('arrivalAmPm', ampm);
    }
    
    // Cerrar el diálogo antes de mostrar la notificación
    setShowTimeDialog(false);
    
    toast({
      title: "Horario actualizado",
      description: `Se ha configurado el horario para ${currentStopInfo.name} (${currentStopInfo.location}).`,
    });
  };

  // Mutation for publishing trips
  const publishTripMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const response = await fetch("/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to publish trip");
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error publishing trip:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Trip published successfully",
        description: "Your trip has been published for the selected date range.",
      });
      
      // Reset form to default state but keep the selected route
      const routeId = form.getValues("routeId");
      form.reset({
        ...form.getValues(),
        segmentPrices: [...segmentPrices], // Keep current segment prices
      });
      
      // Invalidate trips cache
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Volver a la lista de viajes
      setShowForm(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to publish trip",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: FormValues) => {
    const { capacity } = data;
    
    // Verificar que se ha seleccionado un ID de ruta
    if (!selectedRouteId) {
      toast({
        title: "Error de validación",
        description: "Debe seleccionar una ruta",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar que todos los segmentos tienen precios
    const hasInvalidPrices = segmentPrices.some(segment => segment.price <= 0);
    if (hasInvalidPrices) {
      toast({
        title: "Error de validación",
        description: "Todos los segmentos deben tener un precio válido",
        variant: "destructive",
      });
      return;
    }
    
    // Preparar los tiempos de las paradas
    const formattedStopTimes = stopTimes
      .filter(stop => stop !== null && stop.hour && stop.minute && stop.ampm)
      .map(stop => {
        // Asegurarse de que se guardan correctamente todos los campos
        console.log("Enviando tiempo de parada:", stop);
        return {
          hour: stop!.hour,
          minute: stop!.minute,
          ampm: stop!.ampm,
          location: stop!.location || ""
        };
      });
    
    // Convertir tiempos de segmentos a formato adecuado (HH:MM AM/PM)
    const segmentsWithTimesAndPrices = segmentPrices.map((segment: SegmentTimePrice) => {
      const departureTime = `${segment.departureHour}:${segment.departureMinute} ${segment.departureAmPm}`;
      const arrivalTime = `${segment.arrivalHour}:${segment.arrivalMinute} ${segment.arrivalAmPm}`;
      
      return {
        ...segment,
        departureTime,
        arrivalTime
      };
    });
    
    // Asignar el tipo explícitamente para evitar errores de TS
    const segmentDataToSend = segmentsWithTimesAndPrices;
    
    // Preparar datos comunes para crear o actualizar
    const tripData = {
      ...data,
      routeId: selectedRouteId,
      capacity,
      price: Number(data.price),
      segmentPrices: segmentDataToSend,
      stopTimes: formattedStopTimes,
      departureTime: `${data.departureHour}:${data.departureMinute} ${data.departureAmPm}`,
      arrivalTime: `${data.arrivalHour}:${data.arrivalMinute} ${data.arrivalAmPm}`,
    };
    
    if (editingTripId) {
      // Estamos actualizando un viaje existente
      // Usar método PUT en lugar de POST
      fetch(`/api/trips/${editingTripId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...tripData,
          id: editingTripId,
          // No modificar asientos disponibles directamente en edición
        }),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Error al actualizar el viaje');
          }
          return response.json();
        })
        .then(updatedTrip => {
          toast({
            title: "Viaje actualizado",
            description: `El viaje #${editingTripId} ha sido actualizado correctamente.`,
          });
          
          // Volver a la lista y limpiar el estado de edición
          setShowForm(false);
          setEditingTripId(null);
          
          // Invalidar cache para recargar datos
          queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
        })
        .catch(error => {
          console.error('Error actualizando viaje:', error);
          toast({
            title: "Error al actualizar",
            description: error.message,
            variant: "destructive",
          });
        });
    } else {
      // Estamos creando un nuevo viaje
      publishTripMutation.mutate({
        ...tripData,
        availableSeats: capacity, // Inicializar asientos disponibles igual a la capacidad total
      });
    }
  };

  // Guardar el tiempo editado desde el diálogo modal
  const handleSaveTime = () => {
    if (editingStopIndex === null) return;
    saveStopTime(
      editingTimeValue.hour,
      editingTimeValue.minute,
      editingTimeValue.ampm
    );
  };

  // Función para manejar la edición de un viaje
  const handleEditTrip = async (tripId: number) => {
    try {
      // Guardar ID del viaje que se está editando
      setEditingTripId(tripId);
      
      // Primero, obtener los datos del viaje a editar
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error('Error al cargar datos del viaje');
      }
      
      const tripData = await response.json();
      
      // Mostrar el formulario antes de continuar
      setShowForm(true);
      
      // Extraer los datos sobre tiempo de salida y llegada
      const [departureTime, departureAmPm] = tripData.departureTime.split(' ');
      const [departureHour, departureMinute] = departureTime.split(':');
      
      const [arrivalTime, arrivalAmPm] = tripData.arrivalTime.split(' ');
      const [arrivalHour, arrivalMinute] = arrivalTime.split(':');
      
      // Seleccionar la ruta
      setSelectedRouteId(tripData.routeId);
      
      // Inicializar form values
      form.reset({
        routeId: tripData.routeId,
        startDate: tripData.departureDate.split('T')[0],
        endDate: tripData.departureDate.split('T')[0], // Mismo día para edición
        departureHour,
        departureMinute,
        departureAmPm: departureAmPm as "AM" | "PM",
        arrivalHour,
        arrivalMinute,
        arrivalAmPm: arrivalAmPm as "AM" | "PM",
        capacity: tripData.capacity,
        price: tripData.price,
        vehicleType: tripData.vehicleType || "standard",
        segmentPrices: tripData.segmentPrices || [],
      });
      
      // Si hay segmentPrices, actualizar el estado
      if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices)) {
        // Convertir los tiempos en los segmentos
        type SegmentWithTimes = {
          origin: string;
          destination: string;
          price: number;
          departureTime?: string;
          arrivalTime?: string;
          [key: string]: any;
        };
        
        const formattedSegmentPrices = tripData.segmentPrices.map((segment: SegmentWithTimes) => {
          // Asegurarse de que el precio sea un número
          const price = typeof segment.price === 'number' ? segment.price : 
                         typeof segment.price === 'string' ? parseFloat(segment.price) : 0;

          let result = {
            ...segment,
            price: price,
            departureHour: "08",
            departureMinute: "00",
            departureAmPm: "AM" as "AM",
            arrivalHour: "09",
            arrivalMinute: "00",
            arrivalAmPm: "AM" as "AM"
          };
          
          // Si el segmento tiene departureTime y arrivalTime
          if (segment.departureTime && segment.arrivalTime) {
            const [depTime, depAmPm] = segment.departureTime.split(' ');
            const [depHour, depMinute] = depTime.split(':');
            
            const [arrTime, arrAmPm] = segment.arrivalTime.split(' ');
            const [arrHour, arrMinute] = arrTime.split(':');
            
            // Validar que los valores AM/PM son correctos
            const validDepAmPm = (depAmPm === "AM" || depAmPm === "PM") ? depAmPm as ("AM" | "PM") : "AM" as ("AM" | "PM");
            const validArrAmPm = (arrAmPm === "AM" || arrAmPm === "PM") ? arrAmPm as ("AM" | "PM") : "AM" as ("AM" | "PM");
            
            console.log("Cargando tiempos de segmento:", {
              origin: segment.origin,
              destination: segment.destination,
              depTime: `${depHour}:${depMinute} ${validDepAmPm}`,
              arrTime: `${arrHour}:${arrMinute} ${validArrAmPm}`
            });
            
            result = {
              ...result,
              departureHour: depHour,
              departureMinute: depMinute,
              departureAmPm: validDepAmPm,
              arrivalHour: arrHour,
              arrivalMinute: arrMinute,
              arrivalAmPm: validArrAmPm
            };
          }
          
          console.log("Segmento formateado para edición:", result);
          return result;
        });
        
        console.log("Segmentos con precios cargados para edición:", formattedSegmentPrices);
        setSegmentPrices(formattedSegmentPrices);
        form.setValue("segmentPrices", formattedSegmentPrices);
      }
      
      // Cargar tiempos de paradas si están disponibles
      if (tripData.stopTimes && Array.isArray(tripData.stopTimes)) {
        console.log("Cargando tiempos de paradas:", tripData.stopTimes);
        
        // Nos aseguramos de que todos los campos estén presentes
        const validatedStopTimes = tripData.stopTimes.map((stop: any) => {
          if (!stop.hour || !stop.minute || !stop.ampm) {
            // Si hay valores faltantes, establecemos valores predeterminados
            return {
              hour: stop.hour || "08",
              minute: stop.minute || "00",
              ampm: (stop.ampm === "AM" || stop.ampm === "PM") ? stop.ampm as "AM" | "PM" : "AM" as "AM" | "PM",
              location: stop.location || ""
            };
          }
          return stop;
        });
        
        setStopTimes(validatedStopTimes);
      }
      
      toast({
        title: "Viaje cargado para edición",
        description: `Editando viaje #${tripId} de la ruta ${tripData.route?.name || 'desconocida'}`,
      });
    } catch (error) {
      console.error("Error al cargar el viaje para edición:", error);
      toast({
        title: "Error al cargar el viaje",
        description: "No se pudieron obtener los datos del viaje. Inténtelo de nuevo.",
        variant: "destructive"
      });
    }
  };

  // Función para mostrar el formulario de creación de nuevo viaje
  const handleNewTrip = () => {
    form.reset({
      routeId: 0,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      departureHour: "08",
      departureMinute: "00",
      departureAmPm: "AM",
      arrivalHour: "12",
      arrivalMinute: "00",
      arrivalAmPm: "PM",
      capacity: 18,
      price: 450,
      vehicleType: "standard",
      segmentPrices: [],
    });
    setSelectedRouteId(null);
    setSegmentPrices([]);
    setStopTimes([]);
    setEditingTripId(null);
    setShowForm(true);
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
            <ClockIcon className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Gestión de Viajes</h2>
        </div>
        
        {!showForm && (
          <Button 
            onClick={handleNewTrip}
            className="bg-primary hover:bg-primary-dark text-white"
            size="sm"
          >
            <CalendarPlusIcon className="mr-2 h-4 w-4" />
            Crear nuevo viaje
          </Button>
        )}
        
        {showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(false)}
          >
            <XIcon className="mr-2 h-4 w-4" />
            Volver a la lista
          </Button>
        )}
      </div>
      
      {showForm ? (
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Main Trip Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Route Selection */}
                  <FormField
                    control={form.control}
                    name="routeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruta</FormLabel>
                        <Select 
                          onValueChange={handleRouteChange}
                          value={field.value ? String(field.value) : ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar una ruta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {routesQuery.data?.map((route: Route) => (
                              <SelectItem key={route.id} value={String(route.id)}>
                                {route.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Capacity */}
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacidad del vehículo</FormLabel>
                        <div className="text-xs text-gray-500 mb-1">Número total de asientos disponibles</div>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Número de pasajeros"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || "")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Vehicle Type */}
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de vehículo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo de vehículo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Estándar (18-25 asientos)</SelectItem>
                            <SelectItem value="premium">Premium (15-18 asientos)</SelectItem>
                            <SelectItem value="luxury">Lujo (10-16 asientos)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Date Range Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha del primer viaje</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <CalendarIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <Input
                              type="date"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* End Date */}
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha del último viaje</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <CalendarIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <Input
                              type="date"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Time Selection */}
                <div className="mb-4">
                  <p className="text-sm text-gray-500">
                    Configure los horarios de salida y llegada en la pestaña "Horarios de paradas" a continuación. Los tiempos que configure para el origen y destino principal se utilizarán como horario principal del viaje.
                  </p>
                </div>
                
                {/* Route Segment Pricing (conditional) */}
                {selectedRouteId && routeSegmentsQuery.data && (
                  <div className="mt-8 border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {routeSegmentsQuery.data.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Configure los precios por segmento y los tiempos estimados para cada parada de este viaje.
                    </p>
                    
                    <Tabs defaultValue="segment-prices">
                      <TabsList className="mb-6">
                        <TabsTrigger value="segment-prices">Precios por segmento</TabsTrigger>
                        <TabsTrigger value="stop-times">Tiempos de parada</TabsTrigger>
                        <TabsTrigger value="capacity-settings">Capacidad</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="segment-prices">
                        <p className="text-sm text-gray-500 mb-4">
                          Configure los precios para cada segmento de la ruta. Los segmentos entre diferentes ciudades requieren una configuración manual.
                        </p>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio (MXN)</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {segmentPrices.map((segment, index) => (
                                <tr key={`${segment.origin}-${segment.destination}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{segment.origin}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{segment.destination}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 w-32">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="10"
                                      value={segment.price || ""}
                                      onChange={(e) => updateSegmentPrice(index, Number(e.target.value))}
                                      className="w-24 h-8 text-right"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="stop-times">
                        <p className="text-sm text-gray-500 mb-4">
                          Configure los tiempos estimados de llegada a cada parada de la ruta. Estos tiempos se utilizarán en itinerarios y 
                          para calcular estimaciones de tiempo para pasajeros.
                        </p>
                        <p className="text-sm text-primary-foreground bg-primary/10 p-3 rounded mb-4">
                          Edite directamente los horarios haciendo clic en el campo de tiempo. Los cambios se guardarán cuando publique o actualice el viaje.
                        </p>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {routeSegmentsQuery.data && [
                                routeSegmentsQuery.data.origin,
                                ...(routeSegmentsQuery.data.stops || []),
                                routeSegmentsQuery.data.destination
                              ].map((location, index) => (
                                <tr key={`stop-${index}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {index === 0 ? (
                                      <span className="text-primary">Origen: {location}</span>
                                    ) : routeSegmentsQuery.data?.origin && index === [
                                        routeSegmentsQuery.data.origin, 
                                        ...(routeSegmentsQuery.data.stops || []), 
                                        routeSegmentsQuery.data.destination
                                      ].length - 1 ? (
                                      <span className="text-primary">Destino: {location}</span>
                                    ) : (
                                      <span>Parada {index}: {location}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                    <TimeInput
                                      value={stopTimes[index] ? `${stopTimes[index]?.hour}:${stopTimes[index]?.minute} ${stopTimes[index]?.ampm}` : "08:00 AM"}
                                      onChange={(timeString) => {
                                        const [time, period] = timeString.split(' ');
                                        const [hour, minute] = time.split(':');
                                        
                                        // Actualizar el tiempo directamente en el estado
                                        const newStopTimes = [...stopTimes];
                                        newStopTimes[index] = {
                                          hour: hour,
                                          minute: minute,
                                          ampm: period as "AM" | "PM",
                                          location: location // Aseguramos que la ubicación esté asociada
                                        };
                                        setStopTimes(newStopTimes);
                                        
                                        // Si es origen o destino final, también actualizar los valores del formulario principal
                                        if (index === 0) {
                                          form.setValue('departureHour', hour);
                                          form.setValue('departureMinute', minute);
                                          form.setValue('departureAmPm', period as "AM" | "PM");
                                        } else if (routeSegmentsQuery.data && index === [
                                          routeSegmentsQuery.data.origin, 
                                          ...(routeSegmentsQuery.data.stops || []), 
                                          routeSegmentsQuery.data.destination
                                        ].length - 1) {
                                          form.setValue('arrivalHour', hour);
                                          form.setValue('arrivalMinute', minute);
                                          form.setValue('arrivalAmPm', period as "AM" | "PM");
                                        }
                                      }}
                                      className="w-32"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="capacity-settings">
                        <p className="text-sm text-gray-500 mb-4">
                          Gestione la capacidad de asientos para cada segmento de la ruta.
                        </p>
                        
                        <div className="grid grid-cols-1 gap-4 mb-6">
                          <div className="p-4 border rounded-md">
                            <h4 className="font-medium mb-2">Configuración global de capacidad</h4>
                            <p className="text-sm text-gray-500 mb-4">
                              La capacidad configurada se aplicará a todos los segmentos de la ruta.
                              Capacidad actual: <span className="font-medium">{form.getValues("capacity")} asientos</span>
                            </p>
                            
                            {/* Vehicle Type para capacidad */}
                            <FormField
                              control={form.control}
                              name="vehicleType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tipo de vehículo</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo de vehículo" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="standard">Estándar (18-25 asientos)</SelectItem>
                                      <SelectItem value="premium">Premium (15-18 asientos)</SelectItem>
                                      <SelectItem value="luxury">Lujo (10-16 asientos)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
                
                {/* Submit Button */}
                <div className="mt-8">
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-4">
                    <div className="flex">
                      <InfoIcon className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-slate-700 text-sm mb-1">Generación de Sub-Viajes</p>
                        <p className="text-xs text-slate-600">
                          Al publicar este viaje, el sistema creará automáticamente todos los sub-viajes posibles
                          entre paradas con precios y tiempos proporcionales basados en el recorrido total.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      className="bg-primary hover:bg-primary-dark text-white px-6 py-2 text-lg font-medium"
                      size="lg"
                      disabled={publishTripMutation.isPending || !selectedRouteId}
                    >
                      {publishTripMutation.isPending ? (
                        <span className="flex items-center">
                          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
                          {editingTripId ? "Actualizando..." : "Publicando..."}
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <CalendarPlusIcon className="mr-2 h-5 w-5" />
                          {editingTripId ? "Actualizar Viaje" : "Publicar Viaje"}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        // Mostrar la lista de viajes cuando no se muestra el formulario
        <TripList onEditTrip={handleEditTrip} />
      )}
      
      {/* Ya no necesitamos el diálogo para editar tiempos, ahora se edita directamente en la tabla */}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTimeDialog(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    type="button" 
                    onClick={(e) => {
                      // Evitar que el evento se propague y envíe el formulario
                      e.preventDefault();
                      e.stopPropagation();
                      
                      if (editingStopIndex === null) return;
                      const currentTime = stopTimes[editingStopIndex];
                      if (currentTime) {
                        saveStopTime(currentTime.hour, currentTime.minute, currentTime.ampm);
                      }
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-500 pt-4">
              <p className="flex items-center">
                <InfoIcon className="h-4 w-4 mr-2 text-primary" />
                Esta hora representa tanto el tiempo de llegada como de salida para esta ubicación.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}