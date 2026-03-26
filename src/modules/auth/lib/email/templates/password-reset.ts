import he from "he";
import {
  trueKhmerLogo,
  lockPassword,
  igLogo,
  threadLogo,
  xLogo,
} from "./logo";

function escapeHtml(input: string) {
  return he.escape(input);
}

function resolveDisplayName(displayName?: string | null) {
  const normalized = displayName?.trim();
  return normalized ? normalized : "there";
}

export function buildPasswordResetTemplate(
  resetUrl: string,
  expiresInMinutes: number,
  displayName?: string | null,
  appName = "True Khmer",
) {
  const currentYear = new Date().getFullYear();
  const name = resolveDisplayName(displayName);
  const safeName = escapeHtml(name);
  const safeAppName = escapeHtml(appName);
  const safeResetUrl = escapeHtml(resetUrl);
  const safeMinutes = escapeHtml(String(expiresInMinutes));
  const logoUrl = trueKhmerLogo;
  const resetIconUrl = lockPassword;
  const igIconUrl = igLogo;
  const threadIconUrl = threadLogo;
  const xIconUrl = xLogo;
  const safePreheader = escapeHtml(
    `Hi ${name}, we received a request to reset your ${appName} password. Use the button in this email to continue.`,
  );
  const preheaderPadding = "&zwnj;&nbsp;".repeat(160);

  return `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
      </style>
    </head>
    <body style="margin:0;padding:0;background:#F1F5F9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;">
      ${safePreheader}
    </div>
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;">
      ${preheaderPadding}
    </div>
    <div style="margin:0;padding:0;background:#F1F5F9;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;padding:34px 16px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px;">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <img src="${logoUrl}" alt="${safeAppName} Logo" width="100" height="32" style="display:block;border:0;outline:none;text-decoration:none;" />
                </td>
              </tr>
              <tr>
                <td style="background:#FFFFFF;border-radius:8px;border:1px solid #E1E7EF;padding:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-bottom:32px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding:10px;background:#EFF6FF;border:1px solid #DBEAFE;border-radius:8px;">
                              <img src="${resetIconUrl}" alt="Reset password icon" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />
                            </td>
                            <td style="padding-left:12px;color:#0F1729;font-size:24px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:600;line-height:24px;">
                              Reset Your Password
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:16px;color:#48566A;font-size:16px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:400;line-height:20px;">
                        Hi ${safeName},
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:24px;color:#48566A;font-size:16px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:400;line-height:20px;">
                        We received a request to reset your password for your ${safeAppName} account.<br /><br />
                        To proceed with the password reset, please click the button below:
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:24px;">
                        <a href="${safeResetUrl}" style="display:inline-block;background:#386FDC;border-radius:12px;padding:14px 24px;color:#FFFFFF;font-size:16px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:600;line-height:20px;text-decoration:none;">
                          Reset Your Password
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:24px;border-top:1px solid #E1E7EF;color:#65758B;font-size:14px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:400;line-height:20px;">
                        This link is valid for ${safeMinutes} minutes.<br />
                        If this wasn&rsquo;t you, no action is needed.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="left" valign="middle" style="color:#65758B;font-size:16px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:400;line-height:24px;padding-bottom:10px;">
                        &copy; ${currentYear} ${safeAppName}. All Rights Reserved.
                      </td>
                      <td align="right" valign="middle" style="padding-bottom:10px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding-right: 16px;">
                              <img src="${xIconUrl}" alt="X icon" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />
                            </td>
                            <td style="padding-right: 16px;">
                              <img src="${igIconUrl}" alt="Instagram icon" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />
                            </td>
                            <td>
                              <img src="${threadIconUrl}" alt="Threads icon" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-bottom:10px;color:#65758B;font-size:14px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:400;line-height:20px;">
                        <a href="https://example.com/unsubscribe" style="color:#64748B;text-decoration:none;">Unsubscribe</a>
                        &nbsp;|&nbsp;
                        <a href="https://example.com/privacy" style="color:#64748B;text-decoration:none;">Privacy Policy</a>
                        &nbsp;|&nbsp;
                        <a href="https://example.com/terms" style="color:#64748B;text-decoration:none;">Terms of Service</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
    </body>
    </html>
  `;
}
