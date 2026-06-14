-- AlterTable: add clerkUserId, make phoneNumber nullable, drop legacy auth columns

-- Add clerkUserId column (nullable to allow gradual migration of existing rows)
ALTER TABLE "users" ADD COLUMN "clerkUserId" TEXT;

-- Make phoneNumber nullable (Clerk does not supply phone numbers during signup)
ALTER TABLE "users" ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- Drop legacy auth columns
ALTER TABLE "users" DROP COLUMN "password";
ALTER TABLE "users" DROP COLUMN "refreshToken";
ALTER TABLE "users" DROP COLUMN "accessToken";

-- Drop supabase unique index before dropping the column
DROP INDEX IF EXISTS "users_supabaseUserId_key";
ALTER TABLE "users" DROP COLUMN "supabaseUserId";

-- CreateIndex: unique constraint on clerkUserId
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");
