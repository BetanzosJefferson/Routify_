import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Building2, Link as LinkIcon } from 'lucide-react';

// Definición de interfaces
interface InvitationDetails {
  valid: boolean;
  message?: string;
  invitation?: {
    id: number;
    token: string;
    expiresAt: string;
    isUsed: boolean;
    createdAt: string;
    company: {
      name: string;
      id: string;
    } | null;
  };
}

const CompanyInvitationPage: React.FC = () => {
  const [, params] = useRoute('/invitacion/:token');
  const token = params?.token;
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar el estado de la invitación
  useEffect(() => {
    const checkInvitation = async () => {
      if (!token) {
        setError('Token de invitación no válido');
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/company-invitations/${token}/verify`);
        setInvitationDetails(response as InvitationDetails);
        setIsLoading(false);
      } catch (err) {
        console.error('Error al verificar la invitación:', err);
        setError('No se pudo verificar la invitación. Por favor, intenta nuevamente.');
        setIsLoading(false);
      }
    };

    checkInvitation();
  }, [token]);

  // Mutación para aceptar la invitación
  const acceptInvitationMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Token no válido');
      return await apiRequest('POST', `/api/company-invitations/${token}/accept`, {});
    },
    onSuccess: () => {
      toast({
        title: '¡Éxito!',
        description: 'Partenariado entre empresas creado correctamente.',
        variant: 'default',
      });
      
      // Invalidar consultas relacionadas para que se actualicen los datos
      queryClient.invalidateQueries({ queryKey: ['/api/company-partnerships'] });
      
      // Actualizar el estado local para mostrar que se aceptó correctamente
      if (invitationDetails && invitationDetails.invitation) {
        setInvitationDetails({
          ...invitationDetails,
          invitation: {
            ...invitationDetails.invitation,
            isUsed: true
          }
        });
      }
    },
    onError: (err) => {
      console.error('Error al aceptar la invitación:', err);
      toast({
        title: 'Error',
        description: 'No se pudo aceptar la invitación. Por favor, intenta nuevamente.',
        variant: 'destructive',
      });
    }
  });

  // Manejar la aceptación de la invitación
  const handleAcceptInvitation = () => {
    acceptInvitationMutation.mutate();
  };

  // Si está cargando, mostrar un indicador
  if (isLoading || isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Verificando invitación</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-center text-muted-foreground">
              Verificando datos de la invitación...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si hay un error, mostrarlo
  if (error || !invitationDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <p className="text-center font-medium">
              {error || 'No se pudo cargar la información de la invitación'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Si la invitación no es válida
  if (!invitationDetails.valid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Invitación no válida</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
            <p className="text-center font-medium">
              {invitationDetails.message || 'Esta invitación ya no es válida o ha expirado.'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Si la invitación es válida pero el usuario no está autenticado
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Iniciar sesión requerido</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
            <p className="text-center mb-4">
              Para aceptar esta invitación, debes iniciar sesión con una cuenta que tenga rol de <strong>Dueño</strong>.
            </p>
            <div className="w-full max-w-xs">
              <Alert>
                <AlertTitle>Información importante</AlertTitle>
                <AlertDescription>
                  Esta invitación es para vincular tu empresa con {invitationDetails.invitation?.company?.name || 'otra empresa'}.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-2">
            <Button variant="default" onClick={() => window.location.href = '/auth?redirect=' + encodeURIComponent(window.location.pathname)}>
              Iniciar sesión
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Cancelar
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Si el usuario está autenticado pero no tiene el rol correcto
  if (user && user.role !== 'dueño') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-amber-600">Permiso requerido</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
            <p className="text-center mb-4">
              Solo los usuarios con rol de <strong>Dueño</strong> pueden aceptar invitaciones de partenariado.
              Tu rol actual es: <strong>{user.role}</strong>
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Si la invitación ya ha sido aceptada
  if (invitationDetails?.invitation?.isUsed || acceptInvitationMutation.isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardHeader>
            <CardTitle className="text-center text-green-600">Partenariado creado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <p className="text-center font-medium mb-4">
              El partenariado entre empresas se ha creado correctamente.
            </p>
            <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span>{invitationDetails.invitation?.company?.name || 'Empresa asociada'}</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="default" onClick={() => window.location.href = '/'}>
              Ir al panel principal
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Renderizar la vista principal para aceptar la invitación
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Invitación de partenariado</CardTitle>
          <CardDescription className="text-center">
            {invitationDetails.invitation?.company?.name || 'Una empresa'} te ha invitado a crear un partenariado
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center p-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building2 className="h-10 w-10 text-primary" />
            <LinkIcon className="h-6 w-6 text-muted-foreground" />
            <Building2 className="h-10 w-10 text-secondary" />
          </div>
          
          <Alert className="mb-6">
            <AlertTitle>¿Qué significa esto?</AlertTitle>
            <AlertDescription>
              Al aceptar esta invitación, ambas empresas podrán transferir pasajeros entre sí.
              Esto facilita la cooperación entre empresas de transporte asociadas.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 w-full mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Empresa que invita:</span>
              <span className="font-medium">{invitationDetails.invitation?.company?.name || 'No disponible'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tu empresa:</span>
              <span className="font-medium">{user?.company}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Fecha de expiración:</span>
              <span className="font-medium">
                {new Date(invitationDetails.invitation?.expiresAt || '').toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-2">
          <Button 
            variant="default" 
            onClick={handleAcceptInvitation}
            disabled={acceptInvitationMutation.isPending}
          >
            {acceptInvitationMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Aceptar invitación
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CompanyInvitationPage;