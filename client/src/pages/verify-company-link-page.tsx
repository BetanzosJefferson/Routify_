import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Helmet } from 'react-helmet-async';

type VerificationResult = {
  valid: boolean;
  expired?: boolean;
  alreadyUsed?: boolean;
  sourceCompanyName?: string;
  sourceCompanyId?: string;
};

export default function VerifyCompanyLinkPage() {
  const [, params] = useRoute('/verify-company-link/:token');
  const token = params?.token;
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    async function verifyToken() {
      if (!token) return;
      
      try {
        setIsLoading(true);
        const res = await fetch(`/api/company-links/verify/${token}`);
        const data = await res.json();
        setVerificationResult(data);
      } catch (error) {
        console.error('Error verificando enlace:', error);
        setVerificationResult({ valid: false });
        toast({
          title: 'Error',
          description: 'No se pudo verificar el enlace. Por favor, intenta nuevamente.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    verifyToken();
  }, [token, toast]);

  const acceptLinkMutation = useMutation({
    mutationFn: async () => {
      setIsVerifying(true);
      const res = await apiRequest('POST', `/api/company-links/accept/${token}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Vínculo establecido',
        description: `Tu empresa ahora está vinculada con ${verificationResult?.sourceCompanyName}`,
      });
      setVerificationResult((prev) => ({
        ...prev!,
        alreadyUsed: true,
      }));
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo establecer el vínculo',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsVerifying(false);
    },
  });

  const handleAcceptLink = () => {
    acceptLinkMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Verificando enlace de vínculo</CardTitle>
            <CardDescription>Por favor espera mientras verificamos el enlace...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si no hay usuario logueado
  if (!user) {
    return (
      <div className="container flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Iniciar sesión requerido</CardTitle>
            <CardDescription>
              Debes iniciar sesión como dueño de empresa para aceptar este vínculo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atención</AlertTitle>
              <AlertDescription>
                Este enlace es para establecer un vínculo entre empresas. Solo un usuario con rol de dueño puede aceptarlo.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button className="w-full" asChild>
              <a href="/auth">Iniciar Sesión</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Si el usuario no es dueño
  if (user.role !== 'dueño') {
    return (
      <div className="container flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Permiso insuficiente</CardTitle>
            <CardDescription>
              Solo los usuarios con rol de dueño pueden aceptar vínculos entre empresas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Permiso denegado</AlertTitle>
              <AlertDescription>
                Tu usuario actual no tiene los permisos necesarios para completar esta acción.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center min-h-screen p-4">
      <Helmet>
        <title>Verificar Vínculo Empresarial | TransRoute</title>
      </Helmet>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Verificación de Vínculo Empresarial</CardTitle>
          <CardDescription>
            Establece un vínculo con otra empresa para transferencias de pasajeros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verificationResult?.valid && !verificationResult.expired && !verificationResult.alreadyUsed ? (
            <>
              <div className="flex justify-center mb-6">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <Alert className="mb-6">
                <AlertTitle>Enlace válido</AlertTitle>
                <AlertDescription>
                  Estás a punto de establecer un vínculo con la empresa:{' '}
                  <strong>{verificationResult.sourceCompanyName}</strong>
                </AlertDescription>
              </Alert>
              <p className="text-center mb-6">
                Este vínculo permitirá a ambas empresas transferir pasajeros entre sí, facilitando
                la coordinación y mejorando el servicio a los clientes.
              </p>
            </>
          ) : verificationResult?.expired ? (
            <>
              <div className="flex justify-center mb-6">
                <AlertTriangle className="h-16 w-16 text-yellow-500" />
              </div>
              <Alert variant="warning" className="mb-6">
                <AlertTitle>Enlace expirado</AlertTitle>
                <AlertDescription>
                  Este enlace ha expirado. Por favor, solicita un nuevo enlace a la empresa remitente.
                </AlertDescription>
              </Alert>
            </>
          ) : verificationResult?.alreadyUsed ? (
            <>
              <div className="flex justify-center mb-6">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <Alert className="mb-6">
                <AlertTitle>Vínculo ya establecido</AlertTitle>
                <AlertDescription>
                  El vínculo con la empresa <strong>{verificationResult.sourceCompanyName}</strong> ya ha sido establecido.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Enlace inválido</AlertTitle>
                <AlertDescription>
                  Este enlace no es válido. Por favor, verifica que la URL sea correcta o solicita
                  un nuevo enlace.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {verificationResult?.valid && !verificationResult.expired && !verificationResult.alreadyUsed ? (
            <Button 
              className="w-full" 
              onClick={handleAcceptLink}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aceptar Vínculo
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" asChild>
              <a href="/">Volver al inicio</a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}