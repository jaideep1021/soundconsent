import { useOutletContext } from "react-router";
import type { BackendSnapshot } from "@/lib/backend-api";
export interface PatientSessionContext {
  snapshot: BackendSnapshot;
  refresh: () => Promise<void>;
  setSnapshot: (snapshot: BackendSnapshot) => void;
  onAccessDenied: () => void;
  setBusy: (busy: boolean) => void;
}
export const usePatientSession = () => useOutletContext<PatientSessionContext>();
