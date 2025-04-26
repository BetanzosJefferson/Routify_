import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Esquema de validación para el formulario de registro
// Esquema de validación para el formulario de registro - lo hacemos dinámico
// porque el campo company es obligatorio solo para el rol de Dueño
const createRegisterFormSchema = (role: string | null) => {
  return z
    .object({
      firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
      lastName: z.string().min(2, "Los apellidos deben tener al menos 2 caracteres"),
      email: z.string().email("Por favor ingrese un correo electrónico válido"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      confirmPassword: z.string(),
      company: role === "dueño" 
        ? z.string().min(1, "El nombre de la empresa es obligatorio para el rol de Dueño")
        : z.string().optional(),
      profilePicture: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    });
};

// Esquema inicial (se actualizará cuando se verifique el rol)
const registerFormSchema = createRegisterFormSchema(null);

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const { token } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [invitationStatus, setInvitationStatus] = useState<
    "loading" | "valid" | "invalid" | "expired"
  >("loading");
  const [invitationRole, setInvitationRole] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      company: "",
      profilePicture: "",
    },
  });

  // Verificar la validez del token de invitación
  useEffect(() => {
    if (!token) {
      setInvitationStatus("invalid");
      return;
    }

    async function verifyToken() {
      try {
        const response = await fetch(`/api/invitations/${token}/verify`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setInvitationStatus("valid");
          setInvitationRole(data.role);
          
          // Actualizar el resolver del formulario con el esquema basado en el rol
          form.clearErrors();
          const newSchema = createRegisterFormSchema(data.role);
          form.setError = form.setError.bind(form);
          form.resolver = zodResolver(newSchema);
          
          if (data.email) {
            setInvitationEmail(data.email);
            form.setValue("email", data.email);
          }
        } else if (data.message.includes("expirado")) {
          setInvitationStatus("expired");
        } else {
          setInvitationStatus("invalid");
        }
      } catch (error) {
        console.error("Error verificando el token:", error);
        setInvitationStatus("invalid");
      }
    }

    verifyToken();
  }, [token, form]);

  const mutation = useMutation({
    mutationFn: async (data: RegisterFormValues) => {
      const response = await fetch(`/api/register/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error en el registro");
      }

      return response.json();
    },
    onSuccess: () => {
      setRegistrationComplete(true);

      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido creada. Ahora puedes iniciar sesión.",
        variant: "default",
      });

      // Redirect to login page after 3 seconds
      setTimeout(() => {
        setLocation("/auth");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error en el registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: RegisterFormValues) {
    mutation.mutate(data);
  }

  // Estados de la página
  if (invitationStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Verificando invitación</CardTitle>
            <CardDescription>Por favor espere mientras verificamos su invitación</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitationStatus === "invalid") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invitación inválida</CardTitle>
            <CardDescription>
              La invitación no es válida o ya ha sido utilizada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                El enlace de invitación que está intentando usar es inválido o ya ha sido utilizado.
                Por favor contacte a un administrador para obtener una nueva invitación.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setLocation("/auth")}>Ir a Iniciar Sesión</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (invitationStatus === "expired") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invitación expirada</CardTitle>
            <CardDescription>La invitación ha expirado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Expirada</AlertTitle>
              <AlertDescription>
                El enlace de invitación que está intentando usar ha expirado.
                Las invitaciones son válidas por 24 horas. Por favor contacte a un administrador
                para obtener una nueva invitación.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setLocation("/auth")}>Ir a Iniciar Sesión</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (registrationComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>¡Registro Exitoso!</CardTitle>
            <CardDescription>Tu cuenta ha sido creada correctamente.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <p className="text-center">
              Serás redirigido a la página de inicio de sesión en unos segundos...
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setLocation("/auth")}>Ir a Iniciar Sesión</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="w-full lg:w-1/2 p-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Crear tu cuenta</CardTitle>
            <CardDescription>
              Completa el formulario a continuación para registrarte como{" "}
              <span className="font-semibold">
                {invitationRole === "superAdmin"
                  ? "Super Admin"
                  : invitationRole === "admin"
                  ? "Administrador"
                  : invitationRole === "callCenter"
                  ? "Call Center"
                  : invitationRole === "checker"
                  ? "Checador"
                  : invitationRole === "driver"
                  ? "Chófer"
                  : invitationRole === "ticketOffice"
                  ? "Taquilla"
                  : invitationRole === "dueño"
                  ? "Dueño"
                  : "Usuario"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellidos</FormLabel>
                        <FormControl>
                          <Input placeholder="Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="usuario@ejemplo.com"
                          type="email"
                          readOnly={!!invitationEmail}
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
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {invitationRole === "dueño" && (
                  <>
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de Empresa</FormLabel>
                          <FormControl>
                            <Input placeholder="Transportes S.A. de C.V." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="profilePicture"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo de la Empresa (URL)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://ejemplo.com/logo.png" 
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Registrarse"
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