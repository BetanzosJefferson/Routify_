import { UserCashBoxesPage } from "@/components/user-cash-boxes/user-cash-boxes-page";
import DefaultLayout from "@/components/layout/default-layout";

export default function UserCashBoxesPageRoute() {
  return (
    <DefaultLayout activeTab="user-cash-boxes">
      <UserCashBoxesPage />
    </DefaultLayout>
  );
}