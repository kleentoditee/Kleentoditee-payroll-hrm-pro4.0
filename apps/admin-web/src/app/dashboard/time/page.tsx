import { redirect } from "next/navigation";

export default function TimeIndexPage() {
  redirect("/dashboard/time/entries");
}
