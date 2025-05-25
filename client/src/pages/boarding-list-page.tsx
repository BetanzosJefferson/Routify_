import { BoardingList } from "@/components/boarding-list/boarding-list";
import DefaultLayout from "@/components/layout/default-layout";

export default function BoardingListPageRoute() {
  return (
    <DefaultLayout activeTab="boarding-list">
      <BoardingList />
    </DefaultLayout>
  );
}