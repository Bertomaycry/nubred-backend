import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_LOGO_URL =
  "https://res.cloudinary.com/dyjd91mmm/image/upload/f_png/v1779787100/Nubred/nubred_logo_wgxsld.svg";

const APP_EMAIL_CONTENT = {
  governance: {
    subject: "You're on the NuBred Governance early adopter list",
    heading: "Thanks for joining NuBred Governance early adopters",
    body: "You're now on our Governance early adopter list. We'll keep you updated as we launch new Governance features and open early access.",
  },
  node: {
    subject: "You're on the NuBred Node early adopter list",
    heading: "Thanks for joining NuBred Node early adopters",
    body: "You're now on our Node early adopter list. We'll keep you updated as we launch new Node features and open early access.",
  },
};

const buildEarlyAdopterEmailHtml = (email, app) => {
  const logoUrl = process.env.NUBRED_LOGO_URL || DEFAULT_LOGO_URL;
  const { heading, body } = APP_EMAIL_CONTENT[app];

  return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin: 0; padding: 0; background-color: #f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td align="center" style="background-color: #000000; padding: 32px 24px;">
                    <img
                      src="${logoUrl}"
                      alt="NuBred"
                      width="160"
                      style="display: block; margin: 0 auto; max-width: 160px; height: auto;"
                    />
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 24px; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #111111;">
                    <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600;">${heading}</h2>
                    <p style="margin: 0 0 16px;">We've received your signup at <strong>${email}</strong>.</p>
                    <p style="margin: 0 0 16px;">${body}</p>
                    <p style="margin: 0;">— The NuBred Team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export const sendEarlyAdopterConfirmation = async (email, app) => {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!process.env.RESEND_API_KEY || !from) {
    throw new Error("Resend is not configured");
  }

  const { subject } = APP_EMAIL_CONTENT[app];

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    html: buildEarlyAdopterEmailHtml(email, app),
  });

  if (error) {
    throw new Error(error.message);
  }
};

export default resend;
