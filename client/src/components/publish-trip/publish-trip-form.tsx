import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ClockIcon, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { publishTripValidationSchema, type Route, type RouteWithSegments, type SegmentPrice } from "@shared/schema";
import { generateSegmentsFromRoute, convertTo24Hour, isSameCity } from "@/lib/utils";

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
  price: number;
  vehicleType: string;
  segmentPrices: SegmentPrice[];
};

export function PublishTripForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [segmentPrices, setSegmentPrices] = useState<SegmentPrice[]>([]);

  // Fetch routes for dropdown
  const routesQuery = useQuery({
    queryKey: ["/api/routes"],
    placeholderData: [],
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
      const segments = route.segments.filter(
        segment => !isSameCity(segment.origin, segment.destination)
      );
      
      const segmentPricesWithDefaultValues = segments.map(segment => ({
        origin: segment.origin,
        destination: segment.destination,
        price: 0,
      }));
      
      setSegmentPrices(segmentPricesWithDefaultValues);
      form.setValue("segmentPrices", segmentPricesWithDefaultValues);
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

  // Mutation for publishing trips
  const publishTripMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/trips", data);
      return response.json();
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
    },
    onError: (error) => {
      toast({
        title: "Failed to publish trip",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: FormValues) => {
    // Convert time format for backend
    publishTripMutation.mutate({
      ...data,
      capacity: Number(data.capacity),
      price: Number(data.price),
      segmentPrices: segmentPrices.map(segment => ({
        ...segment,
        price: Number(segment.price)
      })),
    });
  };

  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <ClockIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Publish Trip</h2>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Main Trip Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Route Selection */}
                <FormField
                  control={form.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Route</FormLabel>
                      <Select 
                        onValueChange={handleRouteChange}
                        value={field.value ? String(field.value) : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a route" />
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
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Number of passengers"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || "")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price per passenger"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || "")}
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
                      <FormLabel>Type of vehicle</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="luxury">Luxury</SelectItem>
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
                      <FormLabel>First trip date</FormLabel>
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
                      <FormLabel>Last trip date</FormLabel>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Departure Time */}
                <div>
                  <FormLabel>Departure time</FormLabel>
                  <div className="flex space-x-2">
                    <FormField
                      control={form.control}
                      name="departureHour"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              placeholder="HH"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departureMinute"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="MM"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departureAmPm"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="AM/PM" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Arrival Time */}
                <div>
                  <FormLabel>Arrival time</FormLabel>
                  <div className="flex space-x-2">
                    <FormField
                      control={form.control}
                      name="arrivalHour"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              placeholder="HH"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalMinute"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="MM"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalAmPm"
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="AM/PM" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              
              {/* Route Segment Pricing (conditional) */}
              {selectedRouteId && routeSegmentsQuery.data && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {routeSegmentsQuery.data.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Configure prices for segments and estimated stop times for this trip.
                  </p>
                  
                  <Tabs defaultValue="segment-prices">
                    <TabsList className="mb-6">
                      <TabsTrigger value="segment-prices">Segment Prices</TabsTrigger>
                      <TabsTrigger value="stop-times">Stop Times</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="segment-prices">
                      <p className="text-sm text-gray-500 mb-4">
                        Configure prices for each segment of the route. Segments between different cities require manual pricing.
                      </p>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origin</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {segmentPrices.map((segment, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{segment.origin}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{segment.destination}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-full"
                                    placeholder="Price"
                                    value={segment.price}
                                    onChange={(e) => updateSegmentPrice(index, parseInt(e.target.value, 10) || 0)}
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <Button 
                                    type="button"
                                    variant="link"
                                    className="text-blue-600 hover:text-blue-800"
                                    onClick={() => updateSegmentPrice(index, segment.price)}
                                  >
                                    Update
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="stop-times">
                      <p className="text-sm text-gray-500 mb-4">
                        Configure estimated stop times at each location. This helps passengers plan their journey.
                      </p>
                      
                      <div className="bg-gray-100 p-6 rounded-md text-center">
                        <p className="text-gray-500">
                          Stop times configuration will be available in future updates.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              
              {/* Submit Button */}
              <div className="flex justify-end mt-6">
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary-dark"
                  disabled={publishTripMutation.isPending || !selectedRouteId}
                >
                  {publishTripMutation.isPending ? "Publishing..." : "Publish Trip"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
