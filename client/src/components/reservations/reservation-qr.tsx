import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";

interface ReservationQRProps {
  reservationId: number;
  size?: number;
  className?: string;
}

const ReservationQR: React.FC<ReservationQRProps> = ({
  reservationId,
  size = 200,
  className = ""
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationId) return;

    setIsLoading(true);
    
    // Construir el URL público para acceder a los detalles de la reservación
    const baseUrl = window.location.origin;
    const reservationUrl = `${baseUrl}/reservations?id=${reservationId}`;
    
    // Generar el código QR
    QRCode.toDataURL(
      reservationUrl,
      {
        width: size,
        margin: 2,
        color: {
          dark: "#000000FF",   // Color de los módulos QR
          light: "#FFFFFFFF"   // Color de fondo
        },
        errorCorrectionLevel: 'M'
      }
    )
      .then(url => {
        setQrDataUrl(url);
        setIsLoading(false);
        setError(null);
      })
      .catch(err => {
        console.error("Error al generar el código QR:", err);
        setError("No se pudo generar el código QR");
        setIsLoading(false);
      });
  }, [reservationId, size]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <p className="text-red-500 text-sm text-center">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {qrDataUrl && (
        <div className="bg-white p-3 rounded-md border border-gray-200 inline-block">
          <img 
            src={qrDataUrl} 
            alt={`QR de reservación #${reservationId}`} 
            className="max-w-full h-auto"
          />
          <div className="text-xs text-center mt-2 text-gray-500">
            Escanea para ver los detalles
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationQR;