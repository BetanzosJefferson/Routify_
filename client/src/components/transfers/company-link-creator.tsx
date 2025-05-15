import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Share, Copy, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function CompanyLinkCreator() {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/company-links/generate-link', {});
      return res.json();
    },
    onSuccess: (data) => {
      setLinkUrl(data.linkUrl);
      toast({
        title: 'Enlace creado exitosamente',
        description: 'Comparte este enlace con el dueño de la otra empresa para establecer un vínculo',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-links'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear enlace',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCopyLink = () => {
    if (linkUrl) {
      navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      toast({
        title: 'Enlace copiado',
        description: 'El enlace ha sido copiado al portapapeles',
      });
      
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    }
  };

  const handleCreateLink = () => {
    createLinkMutation.mutate();
  };

  const handleReset = () => {
    setLinkUrl(null);
    setCopied(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear Vínculo Empresarial</CardTitle>
        <CardDescription>
          Genera un enlace único para compartir con otra empresa y establecer una relación de transferencia de pasajeros.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linkUrl ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Este enlace es de un solo uso y expirará en 48 horas. Compártelo únicamente con el dueño de la empresa con la que deseas establecer un vínculo.
              </AlertDescription>
            </Alert>
            <div className="flex space-x-2">
              <Input
                value={linkUrl}
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink} disabled={copied}>
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button 
              variant="default" 
              className="w-full"
              onClick={handleReset}
            >
              Crear Nuevo Enlace
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Al generar un enlace, podrás compartirlo con el dueño de otra empresa para establecer un vínculo. 
              Esto les permitirá transferir pasajeros entre ambas empresas de manera sencilla.
            </p>
            <Button 
              onClick={handleCreateLink} 
              className="w-full"
              disabled={createLinkMutation.isPending}
            >
              {createLinkMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Share className="mr-2 h-4 w-4" />
                  Generar Enlace de Invitación
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t p-4 text-xs text-gray-500">
        <p>El enlace expira después de 48 horas o al ser utilizado.</p>
      </CardFooter>
    </Card>
  );
}