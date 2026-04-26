import { ComingSoonPage } from "@/components/coming-soon-page";

export default function SchedulePage() {
  return (
    <ComingSoonPage
      title="Schedule"
      description="Team scheduling and shift planning will live here. Use Time entries and Approvals for current timesheet workflows."
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Schedule", href: "/dashboard/schedule" }
      ]}
    />
  );
}
