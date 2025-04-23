import { useState } from "react";
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
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Schema de validación para el formulario de login
const loginFormSchema = z.object({
  username: z.string().min(1, "El correo electrónico es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loginMutation } = useAuth();
  
  // Si el usuario ya está autenticado, redirigir a la página principal
  if (user) {
    setLocation("/");
    return null;
  }

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(data);
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="w-full lg:w-1/2 p-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>TransRoute</CardTitle>
            <CardDescription>
              Inicia sesión en tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input placeholder="usuario@ejemplo.com" type="email" {...field} />
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
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    "Iniciar sesión"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-8 items-center justify-center flex-col text-primary-foreground">
        <div className="max-w-lg">
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
  );
}