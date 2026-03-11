/** Strip +, spaces, dashes from phone number for consistent conversation IDs */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-+]/g, "");
}
