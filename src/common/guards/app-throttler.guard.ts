import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// F-31: the stock guard keys on req.ip alone and its default message leaks
// the exception class name into the UI. A school shares one public IP, so a
// request carrying an email (login) is also keyed by that email — one
// person's typos then can't lock out everyone else on the same network.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected errorMessage =
    'Too many attempts. Please wait a minute and try again.';

  protected getTracker(req: Record<string, any>): Promise<string> {
    const email: unknown = req.body?.email;
    const suffix =
      typeof email === 'string' && email ? `:${email.trim().toLowerCase()}` : '';
    return Promise.resolve(`${req.ip}${suffix}`);
  }
}
