import { Navigate } from "react-router";
import { usePatientSession } from "@/hooks/patient-session";
export default function PatientEntry() {
  const { snapshot } = usePatientSession();
  return <Navigate to={snapshot.status === "completed" ? "summary" : "overview"} replace />;
}
