import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Ingrese un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { loginMutation, user } = useAuth();
  const [_, navigate] = useLocation();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Si el usuario ya está autenticado, redireccionar al dashboard
  if (user) {
    navigate("/dashboard");
    return null;
  }

  const onSubmit = async (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        navigate("/dashboard");
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100">
      <div className="w-full flex flex-col md:flex-row">
        {/* Hero Section */}
        <div className="hidden md:flex md:w-1/2 bg-indigo-600 text-white p-12 flex-col justify-center">
          <div>
            <h1 className="text-4xl font-bold mb-6">TransRoute</h1>
            <p className="text-xl mb-8">
              Sistema Integral de Gestión de Transporte
            </p>
            <p className="text-indigo-200 mb-4">
              Gestione rutas, viajes y reservaciones de forma eficiente
            </p>
            <ul className="space-y-2 text-indigo-200">
              <li>✓ Creación y administración de rutas</li>
              <li>✓ Publicación de viajes</li>
              <li>✓ Gestión de reservaciones</li>
              <li>✓ Generación de boletos</li>
              <li>✓ Reportes y estadísticas</li>
            </ul>
          </div>
        </div>

        {/* Login Form */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-8">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
              <CardDescription className="text-center">
                Ingrese sus credenciales para acceder al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="correo@ejemplo.com"
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
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={isPasswordVisible ? "text" : "password"}
                              placeholder="Contraseña"
                              {...field}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                            >
                              {isPasswordVisible ? "Ocultar" : "Mostrar"}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="text-sm text-center text-muted-foreground">
                ¿Tiene un código de invitación?{" "}
                <a
                  href="/register"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Regístrese aquí
                </a>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}