import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { DefaultLayout } from "@/components/layout/default-layout";
import { ArrowLeft, Copy, LinkIcon, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

export default function CompanyInvitationPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [invitationToken, setInvitationToken] = React.useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = React.useState<string | null>(null);

  // Comprobar si el usuario es dueño
  const isOwner = user?.role === 'dueño';

  // Generar enlace de invitación
  const generateInvitation = async () => {
    try {
      setIsGenerating(true);
      
      const response = await fetch('/api/transfers/generate-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvitationToken(data.token);
        
        // Crear URL completa para la invitación
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/transfers/invitation/${data.token}`;
        setInvitationUrl(inviteUrl);
        
        toast({
          title: "Enlace generado correctamente",
          description: "Se ha creado un enlace único para invitar a otra empresa",
          variant: "default"
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error al generar enlace",
          description: errorData.details || "No se pudo generar el enlace de invitación",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error al generar invitación:", error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar al servidor para generar la invitación",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Función para copiar enlace al portapapeles
  const copyInvitationLink = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl)
        .then(() => {
          toast({
            title: "Enlace copiado",
            description: "El enlace de invitación se ha copiado al portapapeles",
            variant: "default"
          });
        })
        .catch(err => {
          console.error("Error al copiar enlace:", err);
          toast({
            title: "Error al copiar",
            description: "No se pudo copiar el enlace. Intente seleccionar y copiar manualmente.",
            variant: "destructive"
          });
        });
    }
  };

  return (
    <DefaultLayout>
      <div className="container max-w-3xl py-8">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" onClick={() => navigate("/passenger-transfer")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold">Invitar empresa</h1>
        </div>
        
        <Separator className="my-4" />
        
        {!isOwner ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              Solo los usuarios con rol "Dueño" pueden generar invitaciones para transferencias entre empresas.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Generar enlace de invitación</CardTitle>
              <CardDescription>
                Cree un enlace único para que otra empresa pueda recibir transferencias de reservaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitationUrl ? (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm font-medium mb-2">Enlace de invitación:</p>
                    <div className="flex items-center">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-mono truncate">{invitationUrl}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={copyInvitationLink} className="ml-2">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md text-blue-700 border border-blue-200">
                    <p className="font-medium mb-2">Información importante:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Este enlace será válido por 7 días.</li>
                      <li>Solo puede ser utilizado una vez.</li>
                      <li>Compártalo únicamente con el dueño de la empresa que desea autorizar.</li>
                      <li>La empresa invitada debe tener una cuenta en el sistema con rol "Dueño".</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-muted p-6 rounded-md text-center">
                  <LinkIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="mb-6">
                    Genere un enlace de invitación único para compartir con otra empresa
                  </p>
                  <Button 
                    onClick={generateInvitation} 
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generando...
                      </>
                    ) : (
                      <>
                        Generar enlace de invitación
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className={invitationUrl ? "justify-between" : "justify-end"}>
              {invitationUrl && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setInvitationToken(null);
                    setInvitationUrl(null);
                  }}
                >
                  Generar nuevo enlace
                </Button>
              )}
              <Button variant="default" onClick={() => navigate("/passenger-transfer")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalizar
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </DefaultLayout>
  );
}