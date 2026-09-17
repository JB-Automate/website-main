export interface PublicEnquiryCaptureEnvironment {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface PublicEnquiryCaptureConfig {
  origin: string;
  url: string;
  publishableKey: string;
}

export function parsePublicSupabaseUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function parseSupabasePublishableKey(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || !/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(candidate)) return null;
  return candidate;
}

export function getPublicEnquiryCaptureConfig(
  env: PublicEnquiryCaptureEnvironment,
): PublicEnquiryCaptureConfig | null {
  const origin = parsePublicSupabaseUrl(env.PUBLIC_SUPABASE_URL);
  const publishableKey = parseSupabasePublishableKey(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!origin || !publishableKey) return null;

  return { origin, url: origin, publishableKey };
}
