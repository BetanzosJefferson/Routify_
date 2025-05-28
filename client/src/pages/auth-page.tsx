import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Schema de validación para el formulario de login
const loginFormSchema = z.object({
  email: z.string().min(1, "El correo electrónico es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loginMutation } = useAuth();
  
  // Si el usuario ya está autenticado, redirigir según su rol
  useEffect(() => {
    if (user) {
      // Si es comisionista, redirigir directamente a la sección de viajes
      if (user.role === "comisionista") {
        setLocation("/?tab=trips");
      } else {
        // Para otros roles, ir a la página principal
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(data);
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Columna de login - Centrada en móvil */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 order-2 lg:order-1 lg:w-1/2">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center sm:text-left">
            <CardTitle className="text-2xl">TransRoute</CardTitle>
            <CardDescription>
              Inicia sesión en tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="usuario@ejemplo.com" 
                          type="email" 
                          className="h-10"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Contraseña</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          className="h-10"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 mt-2 text-base" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : "Iniciar sesión"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      
      {/* Hero section - Fondo simple en móvil, vista completa en desktop */}
      <div className="bg-primary flex-1 p-6 order-1 lg:order-2 lg:w-1/2 flex items-center justify-center">
        <div className="text-center lg:text-left text-white max-w-md">
          {/* Versión móvil - Logo y título simple */}
          <div className="block lg:hidden">
            <h1 className="text-2xl font-bold mb-2">TransRoute</h1>
            <p className="text-sm text-primary-foreground/80">
              Sistema de gestión de transporte
            </p>
          </div>
          
          {/* Versión desktop - Contenido completo */}
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold mb-4">Bienvenido a TransRoute</h1>
            <p className="text-lg mb-8">
              Plataforma de administración de rutas, viajes y reservaciones para empresas de transporte.
            </p>
            <div className="space-y-4">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                <p>Gestiona rutas y viajes de manera eficiente</p>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                <p>Administra reservaciones y pasajeros</p>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                <p>Sistema de roles para organizar tu equipo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}