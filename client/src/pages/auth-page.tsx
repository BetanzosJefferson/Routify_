import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CarIcon } from "lucide-react";

// Esquema de validación para el formulario de login
const loginFormSchema = z.object({
  username: z.string().min(3, {
    message: "El nombre de usuario debe tener al menos 3 caracteres.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Inicializar el formulario con react-hook-form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Función para manejar el envío del formulario
  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    
    try {
      // Simulamos una autenticación exitosa (a implementar en el futuro)
      console.log("Datos de inicio de sesión:", data);
      
      // Simulamos un retraso para mostrar el estado de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirigir al dashboard después del login exitoso
      setLocation("/dashboard");
    } catch (error) {
      console.error("Error durante el inicio de sesión:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <CarIcon className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          TransRoute
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sistema de Gestión de Transporte
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900">Iniciar sesión</h3>
            <p className="text-sm text-gray-500">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Tu nombre de usuario"
                        autoComplete="username"
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
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Tu contraseña"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    Recordarme
                  </label>
                </div>

                <div className="text-sm">
                  <a
                    href="#"
                    className="font-medium text-primary hover:text-primary-dark"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}