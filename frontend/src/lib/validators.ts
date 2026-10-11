export function validatePdf(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type !== "" && file.type !== "application/pdf")
  )
    return "Choose a PDF file.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > 20 * 1024 * 1024) return "Choose a PDF no larger than 20 MiB.";
  return null;
}
