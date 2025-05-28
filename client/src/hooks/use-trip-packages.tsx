import { useQuery } from "@tanstack/react-query";

export interface Package {
  id: number;
  tripId: number;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  description: string;
  weight: number;
  fragile: boolean;
  amount: number;
  isPaid: boolean;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  status: string;
  companyId?: string;
  createdBy?: number;
  paidBy?: number;
  deliveredBy?: number;
  tripOrigin?: string;
  tripDestination?: string;
  segmentOrigin?: string;
  segmentDestination?: string;
  createdByUser?: { firstName: string; lastName: string };
  paidByUser?: { firstName: string; lastName: string };
  deliveredByUser?: { firstName: string; lastName: string };
}

export function useTripPackages(tripId: number) {
  return useQuery({
    queryKey: ["/api/packages", tripId],
    queryFn: async (): Promise<Package[]> => {
      const response = await fetch(`/api/packages?tripId=${tripId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch packages");
      }
      return response.json();
    },
    enabled: !!tripId,
  });
}