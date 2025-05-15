import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Link, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function CompanyLinkCreator() {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/company-links/generate-link', {});
      return await res.json();
    },
    onSuccess: (data) => {
      setLinkUrl(data.linkUrl);
      setExpiryDate(new Date(data.expiresAt));
      toast({
        title: 'Enlace generado',
        description: 'Se ha generado un enlace único para compartir con otra empresa.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: 'No se pudo generar el enlace. Por favor, intenta nuevamente.',
        variant: 'destructive',
      });
    },
  });

  const handleGenerateLink = () => {
    generateLinkMutation.mutate();
  };

  const handleCopyLink = () => {
    if (linkUrl) {
      navigator.clipboard.writeText(linkUrl);
      toast({
        title: 'Enlace copiado',
        description: 'El enlace ha sido copiado al portapapeles.',
      });
    }
  };

  const formatExpiryDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear Vínculo con Otra Empresa</CardTitle>
        <CardDescription>
          Genera un enlace único para invitar a otra empresa a establecer un vínculo para transferir pasajeros.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Crear Enlace</TabsTrigger>
            <TabsTrigger value="info" disabled={!linkUrl}>
              Enlace Generado
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="space-y-4">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Al generar un enlace, estarás creando una invitación para que otra empresa pueda establecer
                  un vínculo con la tuya. Este enlace será válido por 48 horas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Una vez establecido el vínculo, ambas empresas podrán realizar transferencias de pasajeros 
                  entre sus viajes, facilitando la coordinación y mejorando el servicio.
                </p>
              </div>

              <Button 
                onClick={handleGenerateLink} 
                className="w-full"
                disabled={generateLinkMutation.isPending}
              >
                {generateLinkMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Link className="mr-2 h-4 w-4" />
                    Generar Enlace
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="info" className="space-y-4">
            {linkUrl && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="link-url">Enlace de invitación</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="link-url"
                      value={linkUrl}
                      readOnly
                      className="flex-1"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comparte este enlace con el dueño o administrador de la empresa con la que deseas establecer un vínculo.
                  </p>
                </div>

                {expiryDate && (
                  <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
                    <p>
                      <strong>Expira el:</strong> {formatExpiryDate(expiryDate)}
                    </p>
                    <p className="mt-1">
                      Este enlace solo puede ser utilizado una vez y expirará después de 48 horas.
                    </p>
                  </div>
                )}

                <Button onClick={handleGenerateLink} className="w-full" variant="outline">
                  Generar Nuevo Enlace
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="border-t px-6 py-4 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Los vínculos entre empresas permiten la transferencia coordinada de pasajeros, 
          manteniendo la información de reservas y ofreciendo una mejor experiencia al cliente.
        </p>
      </CardFooter>
    </Card>
  );
}