import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function InvitationAcceptPage() {
  const { toast } = useToast();
  const params = useParams();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "invalid" | "unauthorized" | "success" | "error">("loading");
  const [inviterCompany, setInviterCompany] = useState<{name: string, identifier: string} | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Obtener el token de la URL
  const token = params.token;
  
  // Verificar si el usuario está autenticado y obtener su rol
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/auth/user'],
    onSuccess: (data) => {
      if (data) {
        setUserRole(data.role);
      }
    },
  });
  
  // Verificar la validez del token
  const { isLoading: isValidatingToken } = useQuery({
    queryKey: ['/api/transfers/validate-invitation', token],
    queryFn: async () => {
      return await apiRequest(`/api/transfers/validate-invitation/${token}`, {
        method: 'GET',
      });
    },
    enabled: !!token,
    onSuccess: (data) => {
      if (data && data.valid) {
        setInviterCompany(data.company);
        setStatus(userRole === 'dueño' ? 'success' : 'unauthorized');
      } else {
        setStatus('invalid');
      }
    },
    onError: () => {
      setStatus('invalid');
    },
  });
  
  // Mutación para aceptar la invitación
  const { mutate: acceptInvitation, isPending: isAccepting } = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/transfers/accept-invitation/${token}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitación aceptada",
        description: "La empresa ha sido agregada a la lista de empresas autorizadas.",
      });
      
      // Redirigir a la página de transferencias después de 2 segundos
      setTimeout(() => {
        setLocation("/passenger-transfer");
      }, 2000);
    },
    onError: (error: any) => {
      setStatus('error');
      toast({
        title: "Error al aceptar invitación",
        description: error.message || "Ocurrió un error al procesar la invitación.",
        variant: "destructive",
      });
    },
  });
  
  // Determinar si el usuario puede aceptar la invitación
  const canAccept = status === 'success' && userRole === 'dueño';
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Invitación a Transferencias de Pasajeros</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Solicitud de Autorización</CardTitle>
            <CardDescription>
              Una empresa desea poder transferir reservaciones a tu empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(isLoadingUser || isValidatingToken) && (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Verificando invitación...</p>
              </div>
            )}
            
            {status === 'invalid' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Invitación no válida</AlertTitle>
                <AlertDescription>
                  El enlace de invitación no es válido o ya ha sido utilizado.
                  Por favor, solicita un nuevo enlace a la empresa que te invitó.
                </AlertDescription>
              </Alert>
            )}
            
            {status === 'unauthorized' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Acceso no autorizado</AlertTitle>
                <AlertDescription>
                  Solo los usuarios con rol de dueño pueden aceptar invitaciones para transferencias.
                  Por favor, contacta al dueño de tu empresa para que acepte esta invitación.
                </AlertDescription>
              </Alert>
            )}
            
            {status === 'success' && inviterCompany && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Invitación válida</AlertTitle>
                  <AlertDescription>
                    Has recibido una invitación para autorizar transferencias de reservaciones desde la empresa <strong>{inviterCompany.name}</strong>.
                  </AlertDescription>
                </Alert>
                
                <div className="p-4 border rounded-md">
                  <h3 className="font-medium mb-2">Detalles de la solicitud:</h3>
                  <ul className="space-y-2">
                    <li><span className="font-medium">Empresa solicitante:</span> {inviterCompany.name}</li>
                    <li><span className="font-medium">Identificador:</span> {inviterCompany.identifier}</li>
                    <li>
                      <span className="font-medium">¿Qué implica aceptar?</span>
                      <ul className="list-disc ml-6 mt-1 text-sm text-muted-foreground">
                        <li>La empresa podrá transferir reservaciones a tu empresa</li>
                        <li>Podrás ver y gestionar las reservaciones transferidas</li>
                        <li>Tu empresa aparecerá en la lista de empresas autorizadas de la empresa solicitante</li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </div>
            )}
            
            {status === 'error' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error al procesar</AlertTitle>
                <AlertDescription>
                  Ocurrió un error al procesar la invitación. Por favor, intenta nuevamente más tarde.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex justify-end space-x-4">
            <Button variant="outline" onClick={() => setLocation("/passenger-transfer")}>
              Cancelar
            </Button>
            
            {canAccept && (
              <Button 
                onClick={() => acceptInvitation()} 
                disabled={isAccepting}
              >
                {isAccepting ? "Procesando..." : "Aceptar Invitación"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}