import { Announcements } from "@/components/dashboard/announcements";
import { Birthdays } from "@/components/dashboard/birthdays";
import { EmployeeOfTheMonth } from "@/components/dashboard/employee-of-the-month";
import { PerformanceReviewSummary } from "@/components/dashboard/performance-review-summary";
import { TrainingProgress } from "@/components/dashboard/training-progress";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua organização."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2 space-y-6">
          <EmployeeOfTheMonth />
        </div>
        <div className="xl:col-span-2 space-y-6">
          <Birthdays />
        </div>
        <div className="lg:col-span-2 xl:col-span-4">
           <TrainingProgress />
        </div>
        <div className="lg:col-span-2 xl:col-span-4">
          <Announcements />
        </div>
        <div className="lg:col-span-2 xl:col-span-4">
          <PerformanceReviewSummary />
        </div>
      </div>
    </div>
  );
}
