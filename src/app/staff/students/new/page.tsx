import { redirect } from "next/navigation";

/** Old v1 URL: enrolment now happens in a sheet on the students list. */
export default function NewStudentPage() {
  redirect("/staff/students?enrol=1");
}
