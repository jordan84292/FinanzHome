const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LOGO_URL = `${APP_URL.replace(/\/$/, '')}/icon-512.png`;

export function renderEmailHtml(params: { heading: string; bodyHtml: string }): string {
  return `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; background-color: #1E1B3A; padding: 32px 16px;">
      <div style="max-width: 420px; margin: 0 auto; background-color: #2A2650; border-radius: 16px; overflow: hidden;">
        <div style="padding: 32px 24px 16px; text-align: center;">
          <img src="${LOGO_URL}" alt="FinanzHome" width="64" height="64" style="border-radius: 16px;" />
          <div style="margin-top: 12px; font-size: 20px; font-weight: 600; color: #F3F1FA;">FinanzHome</div>
          <div style="font-size: 13px; color: #A9A3C9;">Tu hogar, tus finanzas</div>
        </div>
        <div style="padding: 8px 24px 32px; color: #F3F1FA;">
          <h1 style="font-size: 17px; margin: 0 0 12px;">${params.heading}</h1>
          ${params.bodyHtml}
        </div>
      </div>
    </div>
  `;
}

export function renderEmailButton(href: string, label: string): string {
  return `
    <a href="${href}" style="display: inline-block; margin-top: 8px; padding: 12px 24px; border-radius: 8px; background: linear-gradient(135deg, #A855F7 0%, #EC4899 100%); color: #ffffff; text-decoration: none; font-weight: 600;">
      ${label}
    </a>
  `;
}
