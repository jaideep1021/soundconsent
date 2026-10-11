export function redactPii(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, "[REDACTED_SSN]")
    .replace(
      /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
      "[REDACTED_PHONE]",
    )
    .replace(/\b(?:participant|subject|patient|full)?\s*name\s*[:#-]\s*[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?){0,2}\b/gi, "[REDACTED_NAME]")
    .replace(/\b(?:my name is|name is)\s+[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?){0,2}\b/g, (match) =>
      `${match.slice(0, match.toLowerCase().indexOf(" is") + 3)} [REDACTED_NAME]`,
    )
    .replace(/\b(?:date of birth|dob)\s*(?:is|:)?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi, "[REDACTED_DOB]")
    .replace(/\b(?:medical record|patient|study)\s*(?:number|no\.?|#|id)\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi, "[REDACTED_ID]")
    .replace(/\b\d{1,6}\s+[A-Z0-9.'-]+(?:\s+[A-Z0-9.'-]+){0,3}\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b\.?/gi, "[REDACTED_ADDRESS]");
}
