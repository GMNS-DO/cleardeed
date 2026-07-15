/**
 * PDPD Act disclosure language for ClearDeed consumer flows.
 *
 * These strings are reused at every point where personal data is collected
 * (checkout, report render, feedback, account deletion). Keeping them in a
 * single module prevents drift between surfaces.
 *
 * PDPD Act 2023 §4(1) requires that the data principal (the user) be told:
 *  - what data is collected
 *  - why it is collected
 *  - how long it is retained
 *  - who it is shared with (if anyone)
 *  - how to exercise their rights (access, correction, erasure, portability)
 */

export const PDPD_RETENTION_DAYS = 365; // reports kept for 1 year post-purchase

export function pdpdDisclosureText(bucket: string): string {
  switch (bucket) {
    case "report":
      return `ClearDeed collects the coordinates, village/plot identifiers, seller name, email, and phone you provide so we can generate your property report and deliver it to you. We retain your report data for ${PDPD_RETENTION_DAYS} days, after which it is deleted unless you have an active subscription. We do not sell or share your personal data with third parties. You can exercise your right to erasure at any time: email support@cleardeed.in with the subject "Delete my data".`;
    case "feedback":
      return `ClearDeed collects your feedback to improve report quality. Your feedback is linked to your report ID, not your name. We retain feedback for ${PDPD_RETENTION_DAYS} days.`;
    case "payment":
      return `Payment data is handled by Razorpay. ClearDeed does not store card numbers, UPI IDs, or other financial data on our servers.`;
    case "account":
      return `Your phone number (via Supabase Auth) identifies your account. You may delete your account and all associated reports at any time from Settings → Delete account.`;
    default:
      return `ClearDeed collects only the minimum data needed to deliver the service you requested. Data is never sold. Contact support@cleardeed.in to exercise your PDPD Act rights.`;
  }
}

export function pdpdConsentLabel(bucket: string): string {
  switch (bucket) {
    case "checkout":
      return "I agree to ClearDeed's data processing as described above. I understand my report is not a legal opinion.";
    default:
      return "I agree to ClearDeed's data processing as described above.";
  }
}
