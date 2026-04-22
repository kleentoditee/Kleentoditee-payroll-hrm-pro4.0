import { redirect } from "next/navigation";

export default function PeopleIndexPage() {
  redirect("/dashboard/people/employees");
}
