import crypto from 'crypto';
import nodemailer from 'nodemailer';

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'AegisTalk <noreply@localhost>';
const SMTP_CONNECTION_TIMEOUT = Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000);
const SMTP_GREETING_TIMEOUT = Number(process.env.SMTP_GREETING_TIMEOUT || 10000);
const SMTP_SOCKET_TIMEOUT = Number(process.env.SMTP_SOCKET_TIMEOUT || 20000);
const SMTP_IP_FAMILY = Number(process.env.SMTP_IP_FAMILY || 4);
const SMTP_ENABLED = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const subjectMap = {
  registration: 'Код подтверждения для регистрации в AegisTalk',
  email_change: 'Подтверждение смены email в AegisTalk',
  '2fa': 'Код двухфакторной аутентификации AegisTalk',
  login: 'Код подтверждения входа в AegisTalk',
  password_change: 'Код смены пароля в AegisTalk'
};

const introMap = {
  registration: 'Вы запросили код для завершения регистрации в AegisTalk.',
  email_change: 'Вы запросили подтверждение смены email в AegisTalk.',
  '2fa': 'Используйте этот код для двухфакторной аутентификации в AegisTalk.',
  login: 'Вы запросили код для входа в AegisTalk.',
  password_change: 'Вы запросили код для смены пароля в AegisTalk.'
};

const transporters = new Map();

const buildTransportOptions = ({ port, secure }) => ({
  host: SMTP_HOST,
  port,
  secure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  family: SMTP_IP_FAMILY,
  connectionTimeout: SMTP_CONNECTION_TIMEOUT,
  greetingTimeout: SMTP_GREETING_TIMEOUT,
  socketTimeout: SMTP_SOCKET_TIMEOUT,
  requireTLS: !secure,
  tls: {
    servername: SMTP_HOST,
    minVersion: 'TLSv1.2'
  }
});

const getTransportAttempts = () => {
  const attempts = [
    { port: SMTP_PORT, secure: SMTP_SECURE, label: `primary:${SMTP_PORT}/${SMTP_SECURE ? 'ssl' : 'starttls'}` }
  ];

  if (!(SMTP_PORT === 465 && SMTP_SECURE === true)) {
    attempts.push({ port: 465, secure: true, label: 'fallback:465/ssl' });
  }

  if (!(SMTP_PORT === 587 && SMTP_SECURE === false)) {
    attempts.push({ port: 587, secure: false, label: 'fallback:587/starttls' });
  }

  if (SMTP_PORT !== 2525) {
    attempts.push({ port: 2525, secure: false, label: 'fallback:2525/starttls' });
  }

  if (SMTP_PORT !== 25) {
    attempts.push({ port: 25, secure: false, label: 'fallback:25/starttls' });
  }

  return attempts.filter((attempt, index, array) => (
    array.findIndex((item) => item.port === attempt.port && item.secure === attempt.secure) === index
  ));
};

const getTransporter = ({ port, secure }) => {
  const key = `${port}:${secure ? 'secure' : 'starttls'}`;

  if (!transporters.has(key)) {
    transporters.set(key, nodemailer.createTransport(buildTransportOptions({ port, secure })));
  }

  return transporters.get(key);
};

const isRetryableSmtpError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNECTION' ||
    code === 'ESOCKET' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENOTFOUND' ||
    message.includes('connection timeout') ||
    message.includes('greeting never received') ||
    message.includes('connect etimedout') ||
    message.includes('connect econnrefused')
  );
};

const wrapMailLayout = ({ eyebrow, title, subtitle = '', bodyHtml, footerNote = '' }) => `
  <div style="margin:0;padding:0;background:#060816;font-family:Arial,'Helvetica Neue',sans-serif;color:#e8eefc;">
    <div style="max-width:680px;margin:0 auto;padding:32px 18px;background:
      radial-gradient(circle at top left, rgba(0,230,180,0.12), transparent 32%),
      radial-gradient(circle at top right, rgba(71,132,255,0.18), transparent 38%),
      linear-gradient(180deg,#060816 0%,#0a1020 100%);">
      <div style="border:1px solid rgba(255,255,255,0.08);border-radius:30px;overflow:hidden;background:rgba(10,16,32,0.92);box-shadow:0 30px 80px rgba(0,0,0,0.38);">
        <div style="padding:34px 34px 28px;background:
          radial-gradient(circle at 15% 10%, rgba(34,197,94,0.18), transparent 28%),
          radial-gradient(circle at 85% 15%, rgba(56,189,248,0.18), transparent 30%),
          linear-gradient(135deg,#0d152a 0%,#101c39 55%,#0b1327 100%);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td align="left">
                <div style="display:inline-block;padding:10px 14px;border-radius:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);">
                  <div style="font-size:22px;font-weight:800;letter-spacing:0.04em;color:#ffffff;">AegisTalk</div>
                </div>
              </td>
              <td align="right">
                <div style="display:inline-block;padding:9px 14px;border-radius:999px;background:rgba(0,229,176,0.12);border:1px solid rgba(0,229,176,0.18);font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8ff7dd;">
                  ${eyebrow}
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top:26px;font-size:30px;line-height:1.2;font-weight:800;color:#ffffff;">
            ${title}
          </div>
          ${subtitle ? `<div style="margin-top:12px;max-width:520px;font-size:15px;line-height:1.8;color:#c8d5f0;">${subtitle}</div>` : ''}
        </div>
        <div style="padding:30px 34px 36px;">
          ${bodyHtml}
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:13px;line-height:1.8;color:#8ea3c7;">
            Это письмо отправлено автоматически сервисом AegisTalk.
            ${footerNote ? `<br>${footerNote}` : ''}
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const buildVerificationMail = (code, purpose) => {
  const subject = subjectMap[purpose] || 'Код подтверждения AegisTalk';
  const intro = introMap[purpose] || 'Используйте этот код для подтверждения действия в AegisTalk.';

  return {
    subject,
    text: [
      'AegisTalk',
      '',
      intro,
      '',
      `Код: ${code}`,
      '',
      'Код действует ограниченное время. Если вы не запрашивали его, просто проигнорируйте это письмо.'
    ].join('\n'),
    html: wrapMailLayout({
      eyebrow: 'Security code',
      title: 'Ваш код подтверждения',
      subtitle: 'Введите этот код в приложении AegisTalk, чтобы продолжить действие.',
      bodyHtml: `
        <div style="padding:22px;border-radius:24px;background:linear-gradient(180deg,rgba(16,27,53,0.96),rgba(10,17,34,0.96));border:1px solid rgba(93,165,255,0.18);">
          <div style="font-size:14px;line-height:1.8;color:#cad7ef;">
            ${intro}
          </div>
          <div style="margin-top:22px;display:inline-block;padding:18px 24px;border-radius:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);font-size:34px;font-weight:800;letter-spacing:0.26em;color:#ffffff;">
            ${code}
          </div>
          <div style="margin-top:20px;font-size:14px;line-height:1.8;color:#9cb0d1;">
            Код действует ограниченное время. Если вы не запрашивали его, просто проигнорируйте это письмо.
          </div>
        </div>
      `
    })
  };
};

const buildGoogleWelcomeMail = ({ firstName }) => {
  const displayName = String(firstName || '').trim() || 'друг';

  return {
    subject: 'Добро пожаловать в AegisTalk',
    text: [
      `Привет, ${displayName}!`,
      '',
      'Ваш аккаунт AegisTalk успешно создан через Google.',
      'Для входа используйте кнопку "Войти через Google".',
      '',
      'Спасибо, что выбрали AegisTalk.'
    ].join('\n'),
    html: wrapMailLayout({
      eyebrow: 'Welcome',
      title: `Привет, ${displayName}!`,
      subtitle: 'Ваш аккаунт уже готов. Осталось только войти и начать общение.',
      bodyHtml: `
        <div style="padding:24px;border-radius:24px;background:linear-gradient(180deg,rgba(13,24,48,0.96),rgba(9,16,31,0.96));border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:16px;line-height:1.85;color:#d4def2;">
            Ваш аккаунт <strong style="color:#ffffff;">AegisTalk</strong> успешно создан через Google.
          </div>
          <div style="margin-top:18px;padding:18px 20px;border-radius:20px;background:rgba(0,229,176,0.08);border:1px solid rgba(0,229,176,0.14);">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8ff7dd;">
              Быстрый вход
            </div>
            <div style="margin-top:10px;font-size:15px;line-height:1.8;color:#d9e3f6;">
              Используйте кнопку <strong style="color:#ffffff;">«Войти через Google»</strong> на экране авторизации.
            </div>
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:separate;border-spacing:0 12px;">
            <tr>
              <td style="width:44px;vertical-align:top;">
                <div style="width:34px;height:34px;border-radius:12px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.16);text-align:center;line-height:34px;font-size:16px;color:#7dd3fc;">1</div>
              </td>
              <td style="font-size:14px;line-height:1.8;color:#c7d3ea;">
                Войдите через тот же Google-аккаунт, который использовали при регистрации.
              </td>
            </tr>
            <tr>
              <td style="width:44px;vertical-align:top;">
                <div style="width:34px;height:34px;border-radius:12px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.16);text-align:center;line-height:34px;font-size:16px;color:#7dd3fc;">2</div>
              </td>
              <td style="font-size:14px;line-height:1.8;color:#c7d3ea;">
                После входа вы сразу попадёте в свой профиль и сможете начать пользоваться приложением.
              </td>
            </tr>
          </table>
        </div>
      `,
      footerNote: 'Если это были не вы, просто проигнорируйте это письмо.'
    })
  };
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!SMTP_ENABLED) {
    throw new Error('Почтовая отправка отключена в публичной веб-копии');
  }

  const attempts = getTransportAttempts();
  let lastError = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const mailTransporter = getTransporter(attempt);

    try {
      const info = await mailTransporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      lastError = error;
      console.error('[Email] SMTP attempt failed:', {
        host: SMTP_HOST,
        port: attempt.port,
        secure: attempt.secure,
        label: attempt.label,
        code: error?.code || null,
        message: error?.message || String(error)
      });

      if (!isRetryableSmtpError(error) || index === attempts.length - 1) {
        break;
      }
    }
  }

  throw new Error(`Ошибка отправки email: ${lastError?.message || 'SMTP delivery failed'}`);
};

export const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export const generateOTP = () => {
  const buffer = crypto.randomBytes(3);
  const number = buffer.readUIntBE(0, 3) % 1000000;
  return number.toString().padStart(6, '0');
};

export const sendVerificationCode = async (email, code, purpose = 'registration') => {
  const mail = buildVerificationMail(code, purpose);
  return sendMail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html
  });
};

export const sendGoogleWelcomeEmail = async ({ email, firstName }) => {
  const mail = buildGoogleWelcomeMail({ firstName });
  return sendMail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html
  });
};

export default { sendVerificationCode, sendGoogleWelcomeEmail, generateCode, generateOTP };
