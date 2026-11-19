import { BadRequestException } from '@nestjs/common';

// Verifies a Google reCAPTCHA v3 token server-side. If no secret key is
// configured (e.g. local dev with nothing set up yet), verification is
// skipped entirely — matches this project's existing pattern for optional
// integrations (SMTP, etc.) defaulting to inert rather than blocking
// everything until configured.
//
// v3 has no checkbox — it's invisible and returns a 0.0-1.0 trust score
// instead of a human having ticked a box, so success alone isn't enough:
// a bot gets a syntactically valid token too, just a low score. 0.5 is
// Google's own documented default threshold.
export async function verifyRecaptcha(
  token: string | undefined,
  secretKey: string | undefined,
): Promise<void> {
  if (!secretKey) return;
  if (!token) {
    throw new BadRequestException('Please complete the reCAPTCHA check');
  }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: secretKey, response: token }),
  });
  const data = (await res.json()) as { success: boolean; score?: number };
  if (!data.success || (data.score !== undefined && data.score < 0.5)) {
    throw new BadRequestException('reCAPTCHA verification failed — please try again');
  }
}
