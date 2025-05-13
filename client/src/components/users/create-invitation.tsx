import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { UserRole } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { AlertCircle, Copy, Check, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { CompanySelectionModal } from "./company-selection-modal";

// Schema de validación
const invitationFormSchema = z.object({
  role: z.string().min(1, "El rol es requerido"),
  // Agregaremos selectedCompanies en tiempo de ejecución para taquilla
});

type InvitationFormValues = z.infer<typeof invitationFormSchema>;

// Tipo extendido para incluir las compañías seleccionadas para usuarios de taquilla
interface InvitationData extends InvitationFormValues {
  selectedCompanies?: string[];
}

// Función para obtener los roles permitidos según el rol del usuario autenticado
function getFilteredRoles(userRole?: string): string[] {
  // Si el usuario es dueño, ahora también puede invitar a administradores y comisionistas
  if (userRole === UserRole.OWNER) {
    return [
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.CALL_CENTER,
      UserRole.CHECKER,
      UserRole.DRIVER,
      UserRole.COMMISSIONER
    ];
  }
  
  // Si el usuario es admin, solo puede invitar a call center, checador y chofer
  if (userRole === UserRole.ADMIN) {
    return [
      UserRole.CALL_CENTER,
      UserRole.CHECKER,
      UserRole.DRIVER
    ];
  }
  
  // Si es superadmin, puede invitar a todos los roles (incluyendo taquilla)
  return [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.CALL_CENTER,
    UserRole.CHECKER,
    UserRole.DRIVER,
    UserRole.TICKET_OFFICE, // Solo superAdmin puede invitar a taquilla
    UserRole.DEVELOPER,
    UserRole.COMMISSIONER
  ];
}

// Función para obtener el rol por defecto según el rol del usuario
function getDefaultRole(userRole?: string): string {
  // Para dueño, el rol por defecto sería call center
  if (userRole === UserRole.OWNER) {
    return UserRole.CALL_CENTER;
  }
  
  // Para admin, el rol por defecto sería call center
  if (userRole === UserRole.ADMIN) {
    return UserRole.CALL_CENTER;
  }
  
  // Para otros roles (superadmin), el rol por defecto es admin
  return UserRole.ADMIN;
}

interface CreateInvitationFormProps {
  onComplete?: () => void;
}

export function CreateInvitationForm({ onComplete }: CreateInvitationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitation, setInvitation] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCompanySelectionModal, setShowCompanySelectionModal] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const { user } = useAuth(); // Obtener el usuario autenticado
  
  // Determinar los roles que puede invitar según su rol
  const allowedRoles = getFilteredRoles(user?.role);
  
  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      role: getDefaultRole(user?.role),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InvitationData) => {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al crear la invitación");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Crear la URL de registro con el rol incluido
      const baseUrl = window.location.origin;
      const role = form.getValues().role;
      const registrationUrl = `${baseUrl}/register/${data.token}?role=${encodeURIComponent(role)}`;

      setInvitation({
        token: data.token,
        url: registrationUrl,
      });

      toast({
        title: "Enlace de invitación generado",
        description: "El enlace de registro ha sido creado exitosamente",
      });

      // Limpiar selección de empresas
      setSelectedCompanies([]);

      if (onComplete) {
        onComplete();
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Manejador para selección de empresas
  const handleCompanySelection = (companies: string[]) => {
    setSelectedCompanies(companies);
    setShowCompanySelectionModal(false);
    
    // Después de seleccionar las empresas, continuar con la creación de la invitación
    const formData = form.getValues();
    const invitationData: InvitationData = {
      ...formData,
      selectedCompanies: companies
    };
    
    mutation.mutate(invitationData);
  };

  function onSubmit(data: InvitationFormValues) {
    // Si es rol de taquilla y es superAdmin, mostrar el modal de selección de empresas
    if (data.role === UserRole.TICKET_OFFICE && user?.role === UserRole.SUPER_ADMIN) {
      setShowCompanySelectionModal(true);
    } else {
      // Para otros roles, continuar normalmente
      mutation.mutate(data);
    }
  }

  function copyToClipboard() {
    if (invitation) {
      navigator.clipboard.writeText(invitation.url).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
          toast({
            title: "Enlace copiado",
            description: "El enlace de registro ha sido copiado al portapapeles",
          });
        },
        () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo copiar al portapapeles",
          });
        }
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Modal de selección de empresas */}
      <CompanySelectionModal
        isOpen={showCompanySelectionModal}
        onClose={() => setShowCompanySelectionModal(false)}
        onConfirm={handleCompanySelection}
      />
      
      {invitation ? (
        <div className="space-y-6">
          <div className="bg-green-50 border-green-100 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-green-700">
              <Check className="h-5 w-5" />
              <h3 className="font-semibold">¡Enlace de invitación generado!</h3>
            </div>
            <p className="text-sm text-green-700 mb-4">
              El enlace de registro fue creado correctamente. Comparte este enlace con el nuevo usuario para completar el registro.
            </p>
            <div className="bg-white border border-green-200 rounded-md p-3 relative flex items-center gap-2">
              <Input 
                value={invitation.url} 
                readOnly 
                className="font-mono text-xs pr-10 border-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2"
                onClick={copyToClipboard}
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <Alert variant="default" className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Este enlace es de un solo uso y expirará en 24 horas. El usuario deberá completar el registro 
              antes de ese tiempo.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setInvitation(null);
                form.reset();
              }}
            >
              Generar otro enlace
            </Button>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Rol del Usuario</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      {/* SuperAdmin */}
                      {allowedRoles.includes(UserRole.SUPER_ADMIN) && (
                        <div>
                          <RadioGroupItem value={UserRole.SUPER_ADMIN} id="super-admin" className="peer sr-only" />
                          <Label
                            htmlFor="super-admin"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Super Administrador</span>
                            <span className="text-xs text-muted-foreground">
                              Acceso completo al sistema
                            </span>
                          </Label>
                        </div>
                      )}
                      
                      {/* Admin */}
                      {allowedRoles.includes(UserRole.ADMIN) && (
                        <div>
                          <RadioGroupItem value={UserRole.ADMIN} id="admin" className="peer sr-only" />
                          <Label
                            htmlFor="admin"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Administrador</span>
                            <span className="text-xs text-muted-foreground">
                              Acceso completo al sistema
                            </span>
                          </Label>
                        </div>
                      )}

                      {/* Dueño */}
                      {allowedRoles.includes(UserRole.OWNER) && (
                        <div>
                          <RadioGroupItem value={UserRole.OWNER} id="owner" className="peer sr-only" />
                          <Label
                            htmlFor="owner"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Dueño</span>
                            <span className="text-xs text-muted-foreground">
                              Propietario de la empresa de transporte
                            </span>
                          </Label>
                        </div>
                      )}

                      {/* Call Center */}
                      {allowedRoles.includes(UserRole.CALL_CENTER) && (
                        <div>
                          <RadioGroupItem value={UserRole.CALL_CENTER} id="call-center" className="peer sr-only" />
                          <Label
                            htmlFor="call-center"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Call Center</span>
                            <span className="text-xs text-muted-foreground">
                              Crear reservaciones y gestionar pasajeros
                            </span>
                          </Label>
                        </div>
                      )}

                      {/* Checador */}
                      {allowedRoles.includes(UserRole.CHECKER) && (
                        <div>
                          <RadioGroupItem value={UserRole.CHECKER} id="checker" className="peer sr-only" />
                          <Label
                            htmlFor="checker"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Checador</span>
                            <span className="text-xs text-muted-foreground">
                              Verificar y confirmar pasajeros
                            </span>
                          </Label>
                        </div>
                      )}

                      {/* Chofer */}
                      {allowedRoles.includes(UserRole.DRIVER) && (
                        <div>
                          <RadioGroupItem value={UserRole.DRIVER} id="driver" className="peer sr-only" />
                          <Label
                            htmlFor="driver"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Chófer</span>
                            <span className="text-xs text-muted-foreground">
                              Ver viajes asignados
                            </span>
                          </Label>
                        </div>
                      )}

                      {/* Taquilla */}
                      {allowedRoles.includes(UserRole.TICKET_OFFICE) && (
                        <div>
                          <RadioGroupItem value={UserRole.TICKET_OFFICE} id="ticket-office" className="peer sr-only" />
                          <Label
                            htmlFor="ticket-office"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Taquilla</span>
                            <span className="text-xs text-muted-foreground">
                              Vender boletos y gestionar reservas
                            </span>
                          </Label>
                        </div>
                      )}
                      
                      {/* Comisionista */}
                      {allowedRoles.includes(UserRole.COMMISSIONER) && (
                        <div>
                          <RadioGroupItem value={UserRole.COMMISSIONER} id="commissioner" className="peer sr-only" />
                          <Label
                            htmlFor="commissioner"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Comisionista</span>
                            <span className="text-xs text-muted-foreground">
                              Gestionar comisiones por ventas
                            </span>
                          </Label>
                        </div>
                      )}

                      {/* Desarrollador */}
                      {allowedRoles.includes(UserRole.DEVELOPER) && (
                        <div>
                          <RadioGroupItem value={UserRole.DEVELOPER} id="developer" className="peer sr-only" />
                          <Label
                            htmlFor="developer"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <span className="font-semibold">Desarrollador</span>
                            <span className="text-xs text-muted-foreground">
                              Acceso técnico al sistema
                            </span>
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="mt-6">
              <Alert variant="default" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Al generar un enlace de invitación, el usuario podrá registrarse con el rol seleccionado. 
                  El enlace es de un solo uso y caduca en 24 horas.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button type="submit" disabled={mutation.isPending} className="gap-2">
                <UserPlus className="h-4 w-4" />
                {mutation.isPending ? "Generando enlace..." : "Generar enlace de invitación"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}