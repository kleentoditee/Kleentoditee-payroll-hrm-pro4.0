import { ComingSoonPage } from "@/components/coming-soon-page";

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title="Settings"
      description="Organization preferences, integrations, and notification settings will be configured here. User accounts and roles are under Users & roles."
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" }
      ]}
    />
  );
}
