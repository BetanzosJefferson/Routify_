import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPinIcon, PlusCircleIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
import { createRouteValidationSchema } from "@shared/schema";
import { type InsertRoute } from "@shared/schema";

export function CreateRouteForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stops, setStops] = useState<string[]>([]);

  // Initialize form with default values
  const form = useForm<InsertRoute>({
    resolver: zodResolver(createRouteValidationSchema),
    defaultValues: {
      name: "",
      origin: "",
      stops: [],
      destination: "",
    },
  });

  // Mutation for creating a route
  const createRouteMutation = useMutation({
    mutationFn: async (data: InsertRoute) => {
      const response = await apiRequest("POST", "/api/routes", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Route created successfully",
        description: "Your new route has been saved.",
      });
      
      // Reset form
      form.reset();
      setStops([]);
      
      // Invalidate routes cache
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: InsertRoute) => {
    // Ensure stops from state are included
    const formData = {
      ...data,
      stops: stops,
    };
    
    createRouteMutation.mutate(formData);
  };

  // Stop management functions
  const addStop = () => {
    setStops([...stops, ""]);
  };

  const updateStop = (index: number, value: string) => {
    const updatedStops = [...stops];
    updatedStops[index] = value;
    setStops(updatedStops);
  };

  const removeStop = (index: number) => {
    const updatedStops = [...stops];
    updatedStops.splice(index, 1);
    setStops(updatedStops);
  };

  const moveStopUp = (index: number) => {
    if (index === 0) return;
    const updatedStops = [...stops];
    [updatedStops[index], updatedStops[index - 1]] = [updatedStops[index - 1], updatedStops[index]];
    setStops(updatedStops);
  };

  const moveStopDown = (index: number) => {
    if (index === stops.length - 1) return;
    const updatedStops = [...stops];
    [updatedStops[index], updatedStops[index + 1]] = [updatedStops[index + 1], updatedStops[index]];
    setStops(updatedStops);
  };

  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <MapPinIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Create Route</h2>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Route Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Acapulco - México" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Origin */}
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPinIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10"
                          placeholder="Enter origin location"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Stops */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <FormLabel>Stops</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-primary hover:bg-primary hover:bg-opacity-10"
                    onClick={addStop}
                  >
                    <PlusCircleIcon className="h-4 w-4 mr-1" />
                    Add Stop
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {stops.map((stop, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="inline-block w-6 text-sm text-gray-500 text-center">{index + 1}</span>
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPinIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10"
                          placeholder="Enter stop location"
                          value={stop}
                          onChange={(e) => updateStop(index, e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => removeStop(index)}
                      >
                        <Trash2Icon className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => moveStopUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUpIcon className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => moveStopDown(index)}
                        disabled={index === stops.length - 1}
                      >
                        <ChevronDownIcon className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Destination */}
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPinIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10"
                          placeholder="Enter destination location"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Submit Button */}
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary-dark"
                  disabled={createRouteMutation.isPending}
                >
                  {createRouteMutation.isPending ? "Saving..." : "Save Route"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
