import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_LOGO_URL =
  "https://res.cloudinary.com/dyjd91mmm/image/upload/f_png/v1779787100/Nubred/nubred_logo_wgxsld.svg";

const buildEarlyAdopterEmailHtml = (email) => {
  const logoUrl = process.env.NUBRED_LOGO_URL || DEFAULT_LOGO_URL;

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
                    <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600;">Thanks for joining NuBred early adopters</h2>
                    <p style="margin: 0 0 16px;">We've received your signup at <strong>${email}</strong>.</p>
                    <p style="margin: 0 0 16px;">You're now on our early adopter list. We'll keep you updated as we launch new features and open early access.</p>
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

export const sendEarlyAdopterConfirmation = async (email) => {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!process.env.RESEND_API_KEY || !from) {
    throw new Error("Resend is not configured");
  }

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "You're on the NuBred early adopter list",
    html: buildEarlyAdopterEmailHtml(email),
  });

  if (error) {
    throw new Error(error.message);
  }
};

export default resend;
