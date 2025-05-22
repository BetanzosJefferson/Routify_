import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, X, Camera } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  onReservationScanned?: () => void;
}

export function QrScannerModal({ isOpen, onClose, tripId, onReservationScanned }: QrScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);

  // Cleanup function for the scanner
  const cleanupScanner = () => {
    const scannerElement = document.getElementById('qr-reader');
    if (scannerElement) {
      scannerElement.innerHTML = ''; // Clear the scanner element
    }
    setScannerInitialized(false);
  };

  // Initialize the QR scanner
  useEffect(() => {
    if (isOpen && !scannerInitialized) {
      try {
        const qrCodeSuccessCallback = async (decodedText: string) => {
          setIsProcessing(true);
          console.log(`QR Code detected: ${decodedText}`);
          
          try {
            // Extract reservation code from QR
            const reservationCode = decodedText.includes('R-') 
              ? decodedText 
              : decodedText.includes('/') 
                ? decodedText.split('/').pop() 
                : decodedText;
                
            console.log(`Reservation code extracted: ${reservationCode}`);

            // Call the API to mark the reservation as checked
            const response = await apiRequest('POST', `/api/reservations/check-ticket`, {
              reservationCode,
              tripId
            });

            if (response) {
              toast({
                title: "Boleto verificado",
                description: `Se ha registrado correctamente la verificación del boleto.`
              });
              
              // Call the callback function to refresh reservations
              if (onReservationScanned) {
                onReservationScanned();
              }
              
              // Close the modal after successful scan
              setIsProcessing(false);
              onClose();
            } else {
              toast({
                title: "Error al verificar boleto",
                description: "No se pudo verificar el boleto. Intente nuevamente."
              });
              setIsProcessing(false);
            }
          } catch (error) {
            console.error("Error al procesar el código QR:", error);
            toast({
              title: "Error",
              description: "Hubo un problema al procesar el código QR. Intente nuevamente."
            });
            setIsProcessing(false);
          }
        };

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
        };

        setTimeout(() => {
          // Initialize the scanner with a short delay to ensure the DOM is ready
          const scanner = new Html5QrcodeScanner("qr-reader", config, false);
          scanner.render(qrCodeSuccessCallback, (errorMessage: string) => {
            // Handle errors silently to avoid flooding console
            if (errorMessage.includes("User denied camera permission")) {
              toast({
                title: "Permiso denegado",
                description: "Necesitas permitir el acceso a la cámara para escanear códigos QR.",
                variant: "destructive"
              });
            }
          });
          setIsScanning(true);
          setScannerInitialized(true);
        }, 500);
      } catch (error) {
        console.error("Error al inicializar el escáner:", error);
        toast({
          title: "Error",
          description: "No se pudo inicializar el escáner de códigos QR. Verifique que su dispositivo tenga una cámara disponible.",
          variant: "destructive"
        });
      }
    }

    // Cleanup when component unmounts or modal closes
    return () => {
      if (isOpen) {
        cleanupScanner();
        setIsScanning(false);
      }
    };
  }, [isOpen, tripId, onReservationScanned, scannerInitialized]);

  // Handle modal close
  const handleClose = () => {
    cleanupScanner();
    setIsScanning(false);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" /> Escanear Boleto QR
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Procesando el código QR...
              </p>
            </div>
          ) : (
            <div 
              id="qr-reader" 
              className="mx-auto rounded overflow-hidden"
              style={{ maxWidth: '300px' }}
            ></div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            <X className="mr-2 h-4 w-4" /> Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}