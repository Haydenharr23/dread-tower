/** Session-only storage for the AI gate passkey (sent with /api/ai requests). */
export const AI_PASSKEY_STORAGE_KEY = "dread_ai_passkey";

export function getStoredAiPasskey(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = sessionStorage.getItem(AI_PASSKEY_STORAGE_KEY);
    return v && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}
