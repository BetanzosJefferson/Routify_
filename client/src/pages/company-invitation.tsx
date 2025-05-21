import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clipboard, CheckCircle, Link as LinkIcon, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function CompanyInvitationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Obtener el rol del usuario actual
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/auth/user'],
    onSuccess: (data) => {
      if (data) {
        setUserRole(data.role);
      }
    },
  });

  // Mutación para generar un nuevo enlace de invitación
  const { mutate: generateInviteLink, isPending } = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/transfers/generate-invitation', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      // Construir la URL completa con el token generado
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/passenger-transfer/accept/${data.token}`);
      toast({
        title: "Enlace generado correctamente",
        description: "Comparte este enlace con la empresa que deseas invitar.",
      });
      // Refrescar la lista de empresas autorizadas
      queryClient.invalidateQueries({ queryKey: ['/api/transfers/authorized-companies'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al generar enlace",
        description: error.message || "Ocurrió un error al generar el enlace de invitación.",
        variant: "destructive",
      });
    },
  });

  // Función para copiar el enlace al portapapeles
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: "Enlace copiado",
      description: "El enlace ha sido copiado al portapapeles.",
    });
    
    // Restablecer el estado después de 2 segundos
    setTimeout(() => setCopied(false), 2000);
  };

  // Verificar si el usuario tiene rol de dueño
  const isOwner = userRole === 'dueño';

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Invitar Empresa a Transferencias</h1>
        
        {!isOwner && !isLoadingUser && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acceso restringido</AlertTitle>
            <AlertDescription>
              Solo los usuarios con rol de dueño pueden generar invitaciones para transferencias.
            </AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Generar Enlace de Invitación</CardTitle>
            <CardDescription>
              Crea un enlace único para invitar a otra empresa a aceptar transferencias de pasajeros.
              Este enlace será válido para un solo uso y permitirá a la empresa destinataria
              aparecer en tu lista de empresas disponibles para transferencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inviteLink ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Importante</AlertTitle>
                  <AlertDescription>
                    Este enlace es válido para un solo uso. Solo un usuario con rol de dueño
                    en la empresa destinataria podrá aceptar la invitación.
                  </AlertDescription>
                </Alert>
                
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Input 
                      value={inviteLink} 
                      readOnly 
                      className="pr-10"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {copied ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Clipboard className="h-5 w-5" />}
                    </button>
                  </div>
                  <Button onClick={copyToClipboard} variant="outline">
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button 
                  onClick={() => generateInviteLink()} 
                  disabled={isPending || !isOwner}
                  className="flex items-center"
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {isPending ? "Generando..." : "Generar Enlace de Invitación"}
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <p className="text-sm text-muted-foreground">
              Las empresas invitadas aparecerán en la lista de selección al realizar transferencias.
            </p>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}