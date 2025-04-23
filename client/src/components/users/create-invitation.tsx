import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserRole, UserRoleType } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { AlertCircle, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Schema de validación
const invitationFormSchema = z.object({
  role: z.string().min(1, "El rol es requerido"),
  email: z.string().email("Correo electrónico inválido").optional(),
});

type InvitationFormValues = z.infer<typeof invitationFormSchema>;

interface CreateInvitationFormProps {
  onComplete?: () => void;
}

export function CreateInvitationForm({ onComplete }: CreateInvitationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitation, setInvitation] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      role: UserRole.ADMIN,
      email: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InvitationFormValues) => {
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
      // Crear la URL de registro
      const baseUrl = window.location.origin;
      const registrationUrl = `${baseUrl}/register/${data.token}`;

      setInvitation({
        token: data.token,
        url: registrationUrl,
      });

      toast({
        title: "Invitación creada",
        description: "La invitación ha sido creada exitosamente",
      });

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

  function onSubmit(data: InvitationFormValues) {
    mutation.mutate(data);
  }

  function copyToClipboard() {
    if (invitation) {
      navigator.clipboard.writeText(invitation.url).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
          toast({
            title: "URL copiada",
            description: "La URL de invitación ha sido copiada al portapapeles",
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
      {invitation ? (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Comparte esta URL con el nuevo usuario. La invitación expirará en 24 horas y solo se puede usar una vez.
            </AlertDescription>
          </Alert>

          <div className="p-3 bg-muted rounded-md relative">
            <p className="font-mono text-xs break-all pr-8">{invitation.url}</p>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setInvitation(null);
                form.reset();
              }}
            >
              Crear otra invitación
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
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="usuario@ejemplo.com"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creando..." : "Crear Invitación"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}