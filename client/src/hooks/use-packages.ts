import { useQuery } from "@tanstack/react-query";

// Interfaces para manejar la información de los paquetes
export interface Package {
  id: number;
  tripId: number;
  senderName: string;
  senderLastName: string;
  senderPhone: string;
  recipientName: string;
  recipientLastName: string;
  recipientPhone: string;
  packageDescription: string;
  price: number;
  isPaid: boolean;
  paymentMethod: string;
  deliveryStatus: string;
  companyId: string;
  createdBy: number;
  createdAt?: string;
}

interface UsePackagesOptions {
  tripId?: number;
  enabled?: boolean;
}

export function usePackages(options: UsePackagesOptions = {}) {
  const { tripId, enabled = true } = options;
  
  // Construir la URL con los parámetros de consulta si existen
  let url = '/api/packages';
  const params = new URLSearchParams();
  
  if (tripId) {
    params.append('tripId', tripId.toString());
  }
  
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  return useQuery<Package[]>({
    queryKey: ['/api/packages', tripId],
    queryFn: async () => {
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error('Error al cargar las paqueterías');
      }
      
      return response.json();
    },
    enabled: enabled,
  });
}