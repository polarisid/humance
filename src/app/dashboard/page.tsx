import { Announcements } from "@/components/dashboard/announcements";
import { Birthdays } from "@/components/dashboard/birthdays";
import { TrainingProgress } from "@/components/dashboard/training-progress";
import { UserTrainingProgress } from "@/components/dashboard/user-training-progress";
import { WeeklyObservations } from "@/components/dashboard/weekly-observations";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua organização."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 space-y-6">
          <TrainingProgress />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Birthdays />
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Announcements />
        </div>
        <div className="lg:col-span-4">
          <WeeklyObservations />
        </div>
        <div className="lg:col-span-4">
          <UserTrainingProgress />
        </div>
      </div>
    </div>
  );
}
