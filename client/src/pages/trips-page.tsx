import TripList from "@/components/publish-trip/trip-list";
import DefaultLayout from "@/components/layout/default-layout";

export default function TripsPageRoute() {
  return (
    <DefaultLayout activeTab="trips">
      <TripList 
        title="Gestión de Viajes"
        onEditTrip={(tripId) => {
          // Navegar a la página de edición de viaje
          window.location.href = `/edit-trip/${tripId}`;
        }} 
      />
    </DefaultLayout>
  );
}