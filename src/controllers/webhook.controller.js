import { Webhook } from "svix";
import prisma from "../lib/prisma.js";

export const handleClerkWebhook = async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: "Missing svix headers" });
  }

  // req.body is a raw Buffer because the route uses express.raw()
  const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

  const wh = new Webhook(webhookSecret);
  let payload;

  try {
    payload = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const { type, data } = payload;

  try {
    switch (type) {
      case "user.created": {
        const email = data.email_addresses?.[0]?.email_address;

        // Link to an existing record by email if present (legacy account migration)
        const existing = email
          ? await prisma.user.findUnique({ where: { email } })
          : null;

        if (existing) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { clerkUserId: data.id },
          });
        } else {
          await prisma.user.create({
            data: {
              clerkUserId: data.id,
              firstName: data.first_name || "",
              lastName: data.last_name || "",
              email: email || `${data.id}@clerk.local`,
            },
          });
        }
        break;
      }

      case "user.updated": {
        const email = data.email_addresses?.[0]?.email_address;
        const updateData = {};
        if (data.first_name !== undefined) updateData.firstName = data.first_name || "";
        if (data.last_name !== undefined) updateData.lastName = data.last_name;
        if (email) updateData.email = email;

        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({
            where: { clerkUserId: data.id },
            data: updateData,
          });
        }
        break;
      }

      case "user.deleted": {
        // data.deleted is true when Clerk confirms the deletion
        if (data.id) {
          await prisma.user.deleteMany({
            where: { clerkUserId: data.id },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled Clerk webhook event: ${type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`Error processing Clerk webhook [${type}]:`, error);
    return res.status(500).json({ error: "Error processing webhook" });
  }
};
