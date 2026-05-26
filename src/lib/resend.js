import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEarlyAdopterConfirmation = async (email) => {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!process.env.RESEND_API_KEY || !from) {
    throw new Error("Resend is not configured");
  }

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "You're on the NuBred early adopter list",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Thanks for joining NuBred early adopters</h2>
        <p>We've received your signup at <strong>${email}</strong>.</p>
        <p>You're now on our early adopter list. We'll keep you updated as we launch new features and open early access.</p>
        <p>— The NuBred Team</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export default resend;
