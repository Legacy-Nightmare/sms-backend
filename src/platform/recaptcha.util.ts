import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

const SITEVERIFY_TIMEOUT_MS = 5000;

// Verifies a Google reCAPTCHA v2 ("I'm not a robot" checkbox) token
// server-side.
//
// If no secret key is configured, behavior depends on environment: in
// local dev (NODE_ENV unset) verification is skipped entirely — matches
// this project's existing pattern for optional integrations (SMTP, etc.)
// defaulting to inert rather than blocking everything until configured.
// In production (the deployed Docker image sets NODE_ENV=production) a
// missing secret instead refuses every request — a misconfigured deploy
// secret should never silently turn bot protection off for real traffic.
export async function verifyRecaptcha(
  token: string | undefined,
  secretKey: string | undefined,
): Promise<void> {
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('reCAPTCHA is not configured on this server');
    }
    return;
  }
  if (!token) {
    throw new BadRequestException('Please complete the reCAPTCHA check');
  }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
    signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
  });
  const data = (await res.json()) as { success: boolean };
  if (!data.success) {
    throw new BadRequestException('reCAPTCHA verification failed — please try again');
  }
}
