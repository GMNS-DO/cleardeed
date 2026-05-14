/**
 * Email utilities — Resend-powered transactional email.
 *
 * To activate: add RESEND_API_KEY to Vercel env vars.
 *
 * Flow:
 * 1. Report is generated and auto-delivered to buyer email
 * 2. sendReportEmail() is called with the report HTML + recipient email
 * 3. sendFollowUpSurvey() is called 60 days after report generation
 */

/** Resend email client — loaded lazily to avoid compile-time dependency */
async function getResendClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require("resend");
  return new Resend(process.env.RESEND_API_KEY);
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — email stubbed, would send:");
    console.warn(`  to: ${options.to}`);
    console.warn(`  subject: ${options.subject}`);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const resend = await getResendClient();
    const { data, error } = await resend.emails.send({
      from: "ClearDeed <reports@cleardeed.in>",
      to: [options.to],
      subject: options.subject,
      html: options.html,
      reply_to: options.replyTo ?? "support@cleardeed.in",
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false, error: String(error) };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send:", msg);
    return { success: false, error: msg };
  }
}

export async function sendReportEmail(params: {
  to: string;
  reportId: string;
  reportTitle: string;
  reportHtml: string;
  buyerName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, reportId, reportTitle, reportHtml, buyerName } = params;
  const reportUrl = `${process.env.CLEARDEED_BASE_URL ?? "https://cleardeed.in"}/report/${reportId}`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${reportTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f2;font-family:system-ui,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="background:#163d33;border-radius:8px 8px 0 0;padding:20px 24px;">
      <p style="margin:0;color:#a8d4b8;font-size:13px;font-weight:600;">CLEARDEED PROPERTY INTELLIGENCE</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Your report is ready</h1>
    </div>
    <!-- Body -->
    <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #d9ddd4;border-top:none;">
      ${buyerName ? `<p style="margin:0 0 16px;color:#26362f;font-size:15px;">Dear ${buyerName},</p>` : ""}
      <p style="margin:0 0 16px;color:#26362f;font-size:15px;">
        Your ClearDeed property intelligence report has been reviewed and is ready for your review.
      </p>
      <p style="margin:0 0 20px;color:#4b5b52;font-size:14px;">
        <strong>Report:</strong> ${reportTitle}
      </p>
      <!-- CTA Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${reportUrl}"
           style="display:inline-block;background:#1d6f5b;color:#ffffff;font-size:15px;font-weight:600;
                  text-decoration:none;padding:14px 28px;border-radius:6px;">
          View full report →
        </a>
      </div>
      <p style="margin:0 0 12px;color:#4b5b52;font-size:13px;">
        Or open this link directly: <a href="${reportUrl}" style="color:#1d6f5b;">${reportUrl}</a>
      </p>
      <!-- Disclaimer -->
      <div style="margin-top:24px;padding:12px 16px;background:#f7f7f2;border-left:3px solid #8a5f1d;border-radius:4px;">
        <p style="margin:0;color:#5b665f;font-size:12px;line-height:1.6;">
          <strong>Disclaimer:</strong> This report surfaces public land records. It does not certify ownership,
          guarantee the absence of fraud, or recommend any transaction. Every finding should be reviewed by a
          qualified lawyer before you sign any agreement or pay any money.
        </p>
      </div>
    </div>
    <!-- Footer -->
    <div style="padding:16px 8px;text-align:center;">
      <p style="margin:0;color:#8a8f89;font-size:12px;">
        ClearDeed · Bhubaneswar, Odisha · <a href="${process.env.CLEARDEED_BASE_URL ?? "https://cleardeed.in"}" style="color:#1d6f5b;">cleardeed.in</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to,
    subject: `Your ClearDeed report: ${reportTitle}`,
    html: emailHtml,
  });
}

export async function sendFollowUpSurvey(params: {
  to: string;
  reportId: string;
  reportTitle: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, reportId, reportTitle } = params;
  const surveyUrl = `${process.env.CLEARDEED_BASE_URL ?? "https://cleardeed.in"}/survey/${reportId}`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your ClearDeed report — 60-day follow-up</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f2;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#163d33;border-radius:8px 8px 0 0;padding:20px 24px;">
      <p style="margin:0;color:#a8d4b8;font-size:13px;font-weight:600;">CLEARDEED — 60-DAY FOLLOW-UP</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:700;">Did you proceed with the property?</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #d9ddd4;border-top:none;">
      <p style="margin:0 0 16px;color:#26362f;font-size:15px;line-height:1.6;">
        60 days ago, you received a ClearDeed report for <strong>${reportTitle}</strong>.
        We'd like to know what happened — your answer helps us improve the report for future buyers.
      </p>
      <div style="margin:20px 0;">
        <a href="${surveyUrl}"
           style="display:inline-block;background:#1d6f5b;color:#ffffff;font-size:15px;font-weight:600;
                  text-decoration:none;padding:12px 24px;border-radius:6px;">
          Answer 2 quick questions →
        </a>
      </div>
      <p style="margin:0;color:#5b665f;font-size:12px;">
        This survey takes about 60 seconds. Your response is anonymous unless you choose to share contact details.
      </p>
    </div>
    <div style="padding:16px 8px;text-align:center;">
      <p style="margin:0;color:#8a8f89;font-size:12px;">
        ClearDeed · <a href="${process.env.CLEARDEED_BASE_URL ?? "https://cleardeed.in"}" style="color:#1d6f5b;">cleardeed.in</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to,
    subject: `Did you proceed with the ${reportTitle} property?`,
    html: emailHtml,
  });
}