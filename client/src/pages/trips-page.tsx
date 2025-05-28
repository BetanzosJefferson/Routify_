import { TripList } from "@/components/trips/trip-list";
import DefaultLayout from "@/components/layout/default-layout";

export default function TripsPageRoute() {
  return (
    <DefaultLayout activeTab="trips">
      <TripList />
    </DefaultLayout>
  );
}