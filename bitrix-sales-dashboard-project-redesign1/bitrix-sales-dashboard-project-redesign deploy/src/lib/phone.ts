export function normalizePhone(value: unknown): string {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) {
    return "";
  }

  let normalized = stringValue
    .replace(/\s+/g, "")
    .replace(/[()+-]/g, "")
    .replace(/\D/g, "");

  if (normalized.startsWith("8") && normalized.length === 11) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.startsWith("9") && normalized.length === 10) {
    normalized = `7${normalized}`;
  }

  return normalized;
}
