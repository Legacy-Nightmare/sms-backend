import { BadRequestException } from '@nestjs/common';

// Verifies a Google reCAPTCHA v2 ("I'm not a robot") token server-side.
// If no secret key is configured (e.g. local dev with nothing set up yet),
// verification is skipped entirely — matches this project's existing
// pattern for optional integrations (SMTP, etc.) defaulting to inert
// rather than blocking everything until configured.
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
  const data = (await res.json()) as { success: boolean };
  if (!data.success) {
    throw new BadRequestException('reCAPTCHA verification failed — please try again');
  }
}
