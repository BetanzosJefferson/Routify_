import React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { DefaultLayout } from "@/components/layout/default-layout";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [isAccepting, setIsAccepting] = React.useState(false);

  // Verificar la validez del token de invitación
  const {
    data: invitationData,
    isLoading,
    error,
    isError
  } = useQuery({
    queryKey: [`/api/transfers/validate-invitation/${token}`],
    enabled: !!token
  });

  // Manejar la aceptación de la invitación
  const handleAcceptInvitation = async () => {
    if (!token) return;
    
    try {
      setIsAccepting(true);
      
      const response = await fetch(`/api/transfers/accept-invitation/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        toast({
          title: "Invitación aceptada",
          description: "La empresa ha sido autorizada para transferir reservaciones",
          variant: "default"
        });
        
        // Redirigir a la página de transferencias
        setTimeout(() => {
          navigate("/passenger-transfer");
        }, 2000);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error al aceptar invitación",
          description: errorData.error || "No se pudo aceptar la invitación",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error al aceptar invitación:", error);
      toast({
        title: "Error de conexión",
        description: "Hubo un problema al conectar con el servidor",
        variant: "destructive"
      });
    } finally {
      setIsAccepting(false);
    }
  };
  
  // Verificar si el usuario es dueño de empresa
  const isOwner = user?.role === 'dueño';
  
  return (
    <DefaultLayout>
      <div className="container max-w-3xl py-8">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" onClick={() => navigate("/passenger-transfer")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold">Invitación para transferencias</h1>
        </div>
        
        <Separator className="my-4" />
        
        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-1/4" />
            </CardFooter>
          </Card>
        ) : isError ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                Error en la invitación
              </CardTitle>
              <CardDescription>
                No se pudo verificar el enlace de invitación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Enlace inválido</AlertTitle>
                <AlertDescription>
                  {error instanceof Error 
                    ? error.message 
                    : "El enlace de invitación no es válido, ha expirado o ya ha sido utilizado."}
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => navigate("/passenger-transfer")}>
                Volver a transferencias
              </Button>
            </CardFooter>
          </Card>
        ) : invitationData?.valid ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Invitación de empresa
              </CardTitle>
              <CardDescription>
                Has recibido una invitación para autorizar transferencias de reservaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md">
                  <p className="font-medium">Empresa solicitante:</p>
                  <p className="text-lg">{invitationData.company.name}</p>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md text-blue-700 border border-blue-200">
                  <p className="font-medium mb-2">Información importante:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Al aceptar, autoriza a esta empresa a transferir reservaciones a su empresa.</li>
                    <li>Las comisiones por reservaciones de agentes serán heredadas.</li>
                    <li>La autorización puede ser revocada en cualquier momento desde la configuración.</li>
                  </ul>
                </div>
                
                {!isOwner && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Permiso denegado</AlertTitle>
                    <AlertDescription>
                      Solo los dueños de empresa pueden aceptar invitaciones de transferencia.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigate("/passenger-transfer")}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAcceptInvitation} 
                disabled={isAccepting || !isOwner}
                className="bg-green-600 hover:bg-green-700"
              >
                {isAccepting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aceptar invitación
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                Invitación no válida
              </CardTitle>
              <CardDescription>
                El enlace de invitación no es válido o ha expirado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {invitationData?.error || "El enlace de invitación ha expirado o ya ha sido utilizado."}
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => navigate("/passenger-transfer")}>
                Volver a transferencias
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </DefaultLayout>
  );
}