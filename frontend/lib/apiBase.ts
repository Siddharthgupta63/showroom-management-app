// frontend/lib/apiBase.ts
const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE = envBase && envBase.length > 0 ? envBase : "";