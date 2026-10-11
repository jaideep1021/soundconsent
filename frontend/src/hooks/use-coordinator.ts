import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { isUnauthorized } from "@/lib/api-client";
export function useCoordinator() {
  return useQuery({ queryKey: ["auth"], queryFn: async () => {
    try { return await backendApi.me(); } catch (error) { if (isUnauthorized(error)) return null; throw error; }
  }, retry: false, staleTime: 30000 });
}
