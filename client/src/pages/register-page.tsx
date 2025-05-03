import React, { useState, useEffect } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

// Esquema para datos de usuario
const userFormSchema = z.object({
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  lastName: z.string().min(2, "Los apellidos deben tener al menos 2 caracteres"),
  email: z.string().email("Por favor ingrese un correo electrónico válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string(),
});

// Esquema para datos de la empresa
const companyFormSchema = z.object({
  name: z.string().min(1, "El nombre de la empresa es obligatorio"),
  logo: z.string().optional(),
});

// Refinamiento para verificar que las contraseñas coincidan
const userFormSchemaWithRefinement = userFormSchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  }
);

// Esquema para un paso inicial sin validación
const emptySchema = z.object({});

// Esquema completo para combinar todos los datos
const createRegisterFormSchema = (role: string | null) => {
  // Creamos un nuevo esquema en lugar de usar extend en el refinado
  return z.object({
    ...userFormSchema.shape,
    // Campo de empresa solo para compatibilidad con el backend actual
    company: (role === "dueño" || role === "desarrollador")
      ? z.string().min(1, `El nombre de la empresa es obligatorio para el rol de ${role === "dueño" ? "Dueño" : "Desarrollador"}`)
      : z.string().optional(),
    profilePicture: z.string().optional(),
    // Estos campos se usarán para la nueva tabla Companies
    companyData: role === "dueño" 
      ? companyFormSchema
      : z.object({}).optional(),
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    }
  );
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
  const [inviterInfo, setInviterInfo] = useState<{
    firstName: string;
    lastName: string;
    company: string;
    profilePicture: string;
    role: string;
  } | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  // Estado para controlar el paso actual del formulario (para el rol dueño)
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<{
    user: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
    company: {
      name: string;
      logo: string;
    }
  }>({
    user: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
    company: {
      name: "",
      logo: "",
    }
  });

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
          
          // Guardar información del invitante si está disponible
          if (data.inviter) {
            setInviterInfo(data.inviter);
          }
          
          // Actualizar el formulario con el nuevo esquema basado en el rol
          form.clearErrors();
          const newSchema = createRegisterFormSchema(data.role);
          
          // No podemos modificar directamente el resolver, pero podemos 
          // cambiar algunos valores predeterminados basados en el rol
          if (data.role === "dueño" || data.role === "desarrollador") {
            form.setValue("company", "");  // Reset the company value
          }
          
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

  // Función para manejar el paso de información de usuario
  const handleUserStep = (userData: any) => {
    setFormData({
      ...formData,
      user: {
        ...formData.user,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password,
      }
    });
    setCurrentStep(2); // Avanzar al siguiente paso
  };

  // Función para manejar el paso de información de empresa
  const handleCompanyStep = (companyData: any) => {
    setFormData({
      ...formData,
      company: {
        ...formData.company,
        name: companyData.name,
        logo: companyData.logo || "",
      }
    });
    setCurrentStep(3); // Avanzar al paso de confirmación
  };

  // Función final de envío
  function onSubmit(data: RegisterFormValues) {
    if (invitationRole === "dueño") {
      // Para el rol dueño, combinar los datos recopilados en los pasos
      const completeData = {
        firstName: formData.user.firstName,
        lastName: formData.user.lastName,
        email: formData.user.email,
        password: formData.user.password,
        confirmPassword: formData.user.password,
        company: formData.company.name, // Para compatibilidad con el sistema actual
        profilePicture: formData.company.logo,
        companyData: {
          name: formData.company.name,
          logo: formData.company.logo,
        }
      };
      mutation.mutate(completeData as RegisterFormValues);
    } else {
      // Para otros roles, usar el flujo normal
      mutation.mutate(data);
    }
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

  // Formularios específicos para cada paso cuando el rol es dueño
  const UserStepForm = () => {
    // Formulario basado en Zod para el primer paso
    const userStepForm = useForm({
      resolver: zodResolver(userFormSchema),
      defaultValues: {
        firstName: invitationEmail ? form.getValues("firstName") : "",
        lastName: invitationEmail ? form.getValues("lastName") : "",
        email: invitationEmail || "",
        password: "",
        confirmPassword: "",
      },
    });

    return (
      <div className="space-y-4">
        <div className="mb-6">
          <Progress value={33} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Información Personal</span>
            <span>Paso 1 de 3</span>
          </div>
        </div>
        
        <Form {...userStepForm}>
          <form onSubmit={userStepForm.handleSubmit(handleUserStep)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={userStepForm.control}
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
                control={userStepForm.control}
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
              control={userStepForm.control}
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
              control={userStepForm.control}
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
              control={userStepForm.control}
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

            <Button type="submit" className="w-full">
              Siguiente <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </Form>
      </div>
    );
  };

  const CompanyStepForm = () => {
    // Formulario para el segundo paso
    const companyStepForm = useForm({
      resolver: zodResolver(companyFormSchema),
      defaultValues: {
        name: formData.company.name || "",
        logo: formData.company.logo || "",
      },
    });
    
    // Estado para la previsualización del logo
    const [logoPreview, setLogoPreview] = useState<string | null>(
      formData.company.logo || null
    );
    
    // Referencia para el input de archivo
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    // Función para convertir archivo a base64
    const convertToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });
    };
    
    // Manejar carga de archivos
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          const base64 = await convertToBase64(files[0]);
          setLogoPreview(base64);
          companyStepForm.setValue("logo", base64);
        } catch (error) {
          console.error("Error al convertir la imagen:", error);
        }
      }
    };
    
    // Función para abrir el selector de archivos
    const handleSelectFile = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    };

    return (
      <div className="space-y-4">
        <div className="mb-6">
          <Progress value={66} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Información de Empresa</span>
            <span>Paso 2 de 3</span>
          </div>
        </div>
        
        <Form {...companyStepForm}>
          <form onSubmit={companyStepForm.handleSubmit(handleCompanyStep)} className="space-y-4">
            <FormField
              control={companyStepForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Transportes S.A. de C.V." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={companyStepForm.control}
              name="logo"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>Logo de la Empresa</FormLabel>
                  <div className="flex flex-col items-center space-y-4">
                    {/* Previsualización del logo */}
                    <div 
                      className="relative w-32 h-32 border rounded-full overflow-hidden flex items-center justify-center bg-muted cursor-pointer"
                      onClick={handleSelectFile}
                    >
                      {logoPreview ? (
                        <>
                          <img 
                            src={logoPreview} 
                            alt="Logo de la empresa" 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 right-0 p-1 bg-white border border-gray-200 rounded-tl-md">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" x2="12" y1="3" y2="15" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image mb-2">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                          <span className="text-xs">Subir logo</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Mensaje de ayuda */}
                    <p className="text-xs text-muted-foreground text-center">
                      Haz clic para seleccionar una imagen
                    </p>
                    
                    {/* Input de archivo oculto */}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      // Omitimos fieldProps para evitar conflicto con ref
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-2 mt-6">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
              </Button>
              <Button type="submit" className="flex-1">
                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  };

  const SummaryForm = () => {
    // Función para enviar al backend
    const handleSubmit = () => {
      const completeData = {
        firstName: formData.user.firstName,
        lastName: formData.user.lastName,
        email: formData.user.email,
        password: formData.user.password,
        confirmPassword: formData.user.password,
        company: formData.company.name, // Para compatibilidad con el sistema actual
        profilePicture: formData.company.logo,
        companyData: {
          name: formData.company.name,
          logo: formData.company.logo,
        }
      };
      
      mutation.mutate(completeData as RegisterFormValues);
    };

    return (
      <div className="space-y-6">
        <div className="mb-6">
          <Progress value={100} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Confirmación</span>
            <span>Paso 3 de 3</span>
          </div>
        </div>
        
        <div className="border rounded-md p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Información Personal</h3>
            <p className="mt-1 font-medium">{formData.user.firstName} {formData.user.lastName}</p>
            <p className="text-sm">{formData.user.email}</p>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-sm font-medium text-muted-foreground">Información de Empresa</h3>
            <div className="flex items-center gap-4 mt-2">
              {formData.company.logo && (
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border flex-shrink-0">
                  <img 
                    src={formData.company.logo} 
                    alt="Logo de empresa"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/100x100?text=Logo";
                    }}
                  />
                </div>
              )}
              <div>
                <p className="font-medium">{formData.company.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formData.company.logo 
                    ? "Logo personalizado" 
                    : "Sin logo personalizado"}
                </p>
              </div>
            </div>
            
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1"
            onClick={() => setCurrentStep(2)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
          </Button>
          <Button 
            type="button" 
            className="flex-1"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              "Completar Registro"
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Renderizar el formulario apropiado según el rol y paso actual
  const renderForm = () => {
    if (invitationRole === "dueño") {
      // Flujo de registro por pasos para el rol dueño
      switch (currentStep) {
        case 1:
          return <UserStepForm />;
        case 2:
          return <CompanyStepForm />;
        case 3:
          return <SummaryForm />;
        default:
          return <UserStepForm />;
      }
    } else {
      // Flujo normal para otros roles
      return (
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

            {(invitationRole === "desarrollador") && (
              <>
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {invitationRole === "desarrollador" 
                          ? "Nombre de Empresa/Proyecto"
                          : "Nombre de Empresa"
                        }
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Digital Solutions / Proyecto XYZ"
                          {...field} 
                        />
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
                      <FormLabel>
                        {invitationRole === "desarrollador" 
                          ? "Foto de Perfil (URL)"
                          : "Imagen (URL)"
                        }
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://ejemplo.com/imagen.png" 
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
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="w-full lg:w-1/2 p-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {invitationRole === "dueño" 
                ? currentStep === 1 
                  ? "Información Personal" 
                  : currentStep === 2 
                  ? "Información de Empresa" 
                  : "Confirmar Registro"
                : "Crear tu cuenta"
              }
            </CardTitle>
            <CardDescription>
              {invitationRole === "dueño" 
                ? currentStep === 1 
                  ? "Ingresa tus datos personales para comenzar el registro como Dueño" 
                  : currentStep === 2 
                  ? "Ingresa los datos de tu empresa de transporte" 
                  : "Revisa la información antes de completar el registro"
                : `Completa el formulario a continuación para registrarte como ${
                  invitationRole === "superAdmin"
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
                    : invitationRole === "desarrollador"
                    ? "Desarrollador"
                    : invitationRole === "comisionista"
                    ? "Comisionista"
                    : invitationRole || "Usuario"
                }`
              }
            </CardDescription>

            {/* Mostrar información del invitante si está disponible */}
            {inviterInfo && (
              <div className="mt-4 p-4 bg-muted rounded-lg flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {inviterInfo.profilePicture ? (
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarImage src={inviterInfo.profilePicture} alt={`${inviterInfo.firstName} ${inviterInfo.lastName}`} />
                    </Avatar>
                  ) : (
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/5 text-primary">
                        {inviterInfo.firstName.charAt(0)}{inviterInfo.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Invitado por</h4>
                  <p className="text-sm">{inviterInfo.firstName} {inviterInfo.lastName}</p>
                  {inviterInfo.role === "dueño" && (
                    <>
                      <h4 className="text-sm font-medium mt-1">Empresa</h4>
                      <p className="text-sm">{inviterInfo.company || "No especificada"}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {renderForm()}
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