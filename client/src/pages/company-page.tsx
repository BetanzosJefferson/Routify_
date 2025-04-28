import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { companyFormSchema } from "@/lib/form-schemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/layout/page-layout";

export default function CompanyPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("banking");

  // Definir esquema para el formulario de datos bancarios
  type CompanyFormValues = z.infer<typeof companyFormSchema>;

  // Consulta para obtener los datos actuales de la empresa
  const { data: companyData, isLoading } = useQuery({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const response = await fetch("/api/company");
      if (!response.ok) {
        throw new Error("Error al cargar los datos de la empresa");
      }
      return response.json();
    },
  });

  // Configuración del formulario con datos actuales cuando se cargan
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      bankName: "",
      accountHolder: "",
      clabe: "",
      contactPhone: "",
    },
  });

  // Actualizar el formulario cuando se cargan los datos
  useEffect(() => {
    if (companyData) {
      form.reset({
        bankName: companyData.bankName || "",
        accountHolder: companyData.accountHolder || "",
        clabe: companyData.clabe || "",
        contactPhone: companyData.contactPhone || "",
      });
    }
  }, [companyData, form]);

  // Mutación para guardar cambios en los datos bancarios
  const mutation = useMutation({
    mutationFn: async (data: CompanyFormValues) => {
      const response = await apiRequest("PATCH", "/api/company", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al actualizar los datos bancarios");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Datos bancarios actualizados",
        description: "La información bancaria ha sido actualizada correctamente.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejar el envío del formulario
  function onSubmit(data: CompanyFormValues) {
    mutation.mutate(data);
  }

  if (isLoading) {
    return (
      <PageLayout title="Datos de la Empresa" activeTab="company">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Datos de la Empresa" activeTab="company">
      <div className="space-y-6">
        <Tabs defaultValue="banking" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full md:w-auto grid-cols-1 md:grid-cols-2">
            <TabsTrigger value="banking">Datos Bancarios</TabsTrigger>
            <TabsTrigger value="general">Información General</TabsTrigger>
          </TabsList>

          <TabsContent value="banking" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Información Bancaria</CardTitle>
                <CardDescription>
                  Esta información se utilizará para pagos y transferencias. Asegúrate de que los
                  datos sean correctos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Banco</FormLabel>
                            <FormControl>
                              <Input placeholder="BBVA, Banorte, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="accountHolder"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Titular de la Cuenta</FormLabel>
                            <FormControl>
                              <Input placeholder="Transportes S.A. de C.V." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="clabe"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CLABE Interbancaria</FormLabel>
                            <FormControl>
                              <Input placeholder="18 dígitos" {...field} />
                            </FormControl>
                            <FormDescription>
                              CLABE de 18 dígitos para transferencias bancarias.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono de Contacto</FormLabel>
                            <FormControl>
                              <Input placeholder="+52 123 456 7890" {...field} />
                            </FormControl>
                            <FormDescription>
                              Teléfono para consultas relacionadas con pagos.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={mutation.isPending}
                        className="gap-2"
                      >
                        {mutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Guardar Cambios
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
                <CardDescription>
                  Datos generales de tu empresa de transporte.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8">
                  <p className="text-muted-foreground">
                    Esta sección está en desarrollo. Próximamente podrás editar la información general
                    de tu empresa.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
