import { ReservationList } from "@/components/reservations/reservation-list";
import DefaultLayout from "@/components/layout/default-layout";

export default function ReservationsPageRoute() {
  return (
    <DefaultLayout activeTab="reservations">
      <ReservationList />
    </DefaultLayout>
  );
}