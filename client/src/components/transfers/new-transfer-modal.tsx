import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  sourceCompanyId: z.string().min(1, "La compañía de origen es obligatoria"),
  targetCompanyId: z.string().min(1, "La compañía destino es obligatoria"),
  sourceTripId: z.number().min(1, "El viaje de origen es obligatorio"),
  targetTripId: z.number().min(1, "El viaje destino es obligatorio"),
  reason: z.string().optional(),
});

interface NewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferCreated: () => void;
}

export const NewTransferModal = ({ isOpen, onClose, onTransferCreated }: NewTransferModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSourceCompany, setSelectedSourceCompany] = useState<string | null>(
    user?.companyId || null
  );
  const [selectedTargetCompany, setSelectedTargetCompany] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceCompanyId: user?.companyId || "",
      targetCompanyId: "",
      sourceTripId: 0,
      targetTripId: 0,
      reason: "",
    },
  });
  
  // Consulta para obtener compañías
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Error al cargar compañías");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });
  
  // Consulta para obtener viajes de la compañía de origen
  const { data: sourceTrips, isLoading: isLoadingSourceTrips } = useQuery({
    queryKey: ["/api/trips", selectedSourceCompany],
    queryFn: async () => {
      if (!selectedSourceCompany) return [];
      
      const response = await fetch(`/api/trips?companyId=${selectedSourceCompany}`);
      if (!response.ok) {
        throw new Error("Error al cargar viajes de origen");
      }
      return response.json();
    },
    enabled: !!selectedSourceCompany,
    refetchOnWindowFocus: false,
  });
  
  // Consulta para obtener viajes de la compañía destino
  const { data: targetTrips, isLoading: isLoadingTargetTrips } = useQuery({
    queryKey: ["/api/trips", selectedTargetCompany],
    queryFn: async () => {
      if (!selectedTargetCompany) return [];
      
      const response = await fetch(`/api/trips?companyId=${selectedTargetCompany}`);
      if (!response.ok) {
        throw new Error("Error al cargar viajes destino");
      }
      return response.json();
    },
    enabled: !!selectedTargetCompany,
    refetchOnWindowFocus: false,
  });
  
  // Mutación para crear transferencia
  const createTransferMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      return apiRequest("POST", "/api/transfers", {
        ...data,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      form.reset();
      onTransferCreated();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la transferencia",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTransferMutation.mutate(data);
  };
  
  const handleSourceCompanyChange = (value: string) => {
    form.setValue("sourceCompanyId", value);
    form.setValue("sourceTripId", 0);
    setSelectedSourceCompany(value);
  };
  
  const handleTargetCompanyChange = (value: string) => {
    form.setValue("targetCompanyId", value);
    form.setValue("targetTripId", 0);
    setSelectedTargetCompany(value);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva transferencia</DialogTitle>
          <DialogDescription>
            Crea una solicitud para transferir reservaciones entre viajes de diferentes compañías
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="sourceCompanyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Compañía de origen</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={handleSourceCompanyChange}
                      disabled={user?.role !== "superAdmin"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona compañía de origen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company: any) => (
                          <SelectItem key={company.identifier} value={company.identifier}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="targetCompanyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Compañía destino</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={handleTargetCompanyChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona compañía destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.filter((c: any) => c.identifier !== selectedSourceCompany)
                          .map((company: any) => (
                            <SelectItem key={company.identifier} value={company.identifier}>
                              {company.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sourceTripId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Viaje de origen</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => form.setValue("sourceTripId", parseInt(value))}
                      disabled={!selectedSourceCompany || isLoadingSourceTrips}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona viaje de origen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sourceTrips?.map((trip: any) => (
                          <SelectItem key={trip.id} value={String(trip.id)}>
                            {trip.route.name} - {new Date(trip.departureDate).toLocaleDateString()} - {trip.departureTime}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="targetTripId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Viaje destino</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => form.setValue("targetTripId", parseInt(value))}
                      disabled={!selectedTargetCompany || isLoadingTargetTrips}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona viaje destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {targetTrips?.map((trip: any) => (
                          <SelectItem key={trip.id} value={String(trip.id)}>
                            {trip.route.name} - {new Date(trip.departureDate).toLocaleDateString()} - {trip.departureTime}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de la transferencia</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Indica el motivo de la transferencia" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createTransferMutation.isPending}
              >
                {createTransferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear transferencia"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};