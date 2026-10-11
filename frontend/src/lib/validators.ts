import { z } from "zod";
export const normalizeName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const name = z
  .string()
  .trim()
  .min(2, "Enter a full name.")
  .max(120, "Use 120 characters or fewer.");
const dob = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date <= new Date() &&
    date.getUTCFullYear() >= 1900
  );
}, "Enter a valid date of birth that is not in the future.");
export const identitySchema = z.object({ patientName: name, dateOfBirth: dob });
export const newSessionSchema = identitySchema.extend({
  documentId: z.string().min(1, "Select a document."),
});
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter a demo password."),
});
export const settingsSchema = z.object({
  strictness: z.enum(["balanced", "strict", "lenient"]),
  retries: z.number().int().min(1).max(5),
  autoAdvance: z.boolean(),
  verbal: z.boolean(),
});
export function validatePdf(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type !== "" && file.type !== "application/pdf")
  )
    return "Choose a PDF file.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > 10 * 1024 * 1024) return "Choose a PDF no larger than 10 MB.";
  return null;
}
