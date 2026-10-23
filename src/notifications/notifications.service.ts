import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('SMTP_FROM', 'no-reply@example.com');

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const password = this.configService.get<string>('SMTP_PASSWORD');

    // Without SMTP credentials configured (e.g. a fresh demo checkout), we
    // still want the app to run — emails are just logged instead of sent.
    if (!host || !user || !password) {
      this.logger.warn('SMTP not configured — guardian emails will be logged, not sent');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: { user, pass: password },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[email not sent, SMTP disabled] to=${to} subject="${subject}"`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }
}
