import nodemailer from 'nodemailer';
import type { Env } from '../config/env';
import type { Logger } from '../lib/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Gửi email. Khi lập trình (`MAIL_DRIVER=console`) thư được in ra log thay vì gửi thật,
 * để thử quên mật khẩu mà không cần tài khoản email.
 */
export function createMailer(
  env: Pick<
    Env,
    'MAIL_DRIVER' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS' | 'MAIL_FROM'
  >,
  logger: Logger,
): Mailer {
  if (env.MAIL_DRIVER === 'console') {
    return {
      async send(message) {
        logger.info(
          { mail: { to: message.to, subject: message.subject, text: message.text } },
          'Email (chế độ console — không gửi thật)',
        );
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return {
    async send(message) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
  };
}
