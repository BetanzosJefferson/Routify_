export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  company?: string;
  profilePicture?: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedId: number | null;
  metaData?: string; // JSON data para información adicional
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  totalAmount: number;
  passengers: Array<Passenger>;
  trip?: Trip;
}

export interface Passenger {
  id: number;
  firstName: string;
  lastName: string;
  reservationId: number;
}

export interface Trip {
  id: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  availableSeats: number;
  route?: Route;
}

export interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  stops: string[];
}