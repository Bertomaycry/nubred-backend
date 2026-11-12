/**
 * Words in the client invitation email. The button is the same for both.
 * `existing` is true when this email already has a NuBred account.
 */
export function clientInvitationCopy({
  companyName,
  roleLabel,
  expiresInDays,
  existing = false,
}) {
  if (existing) {
    return {
      subject: `You're invited to join ${companyName} on NuBred`,
      heading: `You're invited to join ${companyName}`,
      body: `Click the Accept invitation button to join ${companyName} as ${roleLabel}. This invitation expires in ${expiresInDays} days.`,
      button: "Accept invitation",
    };
  }
  return {
    subject: `You're invited to ${companyName} on NuBred`,
    heading: `You're invited to ${companyName}`,
    body: `Click the Accept invitation button to set up your NuBred account and join ${companyName} as ${roleLabel}. This invitation expires in ${expiresInDays} days.`,
    button: "Accept invitation",
  };
}
