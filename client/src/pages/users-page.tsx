import { UsersPage } from "@/components/users/users-page";
import DefaultLayout from "@/components/layout/default-layout";

export default function UsersPageRoute() {
  return (
    <DefaultLayout activeTab="users">
      <UsersPage />
    </DefaultLayout>
  );
}