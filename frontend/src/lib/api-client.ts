import axios from "axios";
import { ZodError } from "zod";

import { queryClient } from "./query-client";

// Credentials are held only in HttpOnly cookies.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 120_000,
  withCredentials: true,
});

export function apiError(error: unknown): string {
  if (error instanceof ZodError) return "The backend returned an unexpected response. Check the report before submitting again.";
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
    if (!error.response) return "Could not reach the backend. The request may have completed; check the report before submitting again.";
    return `Backend request failed (${error.response.status}).`;
  }
  return error instanceof Error ? error.message : "Request failed.";
}

export const isUnauthorized = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 401;

apiClient.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.url !== "/auth/login" && error.config?.url !== "/auth/me" && !error.config?.url?.endsWith("/access")) {
    queryClient.removeQueries({ queryKey: ["coordinator"] });
    queryClient.setQueryData(["auth"], null);
  }
  return Promise.reject(error);
});
