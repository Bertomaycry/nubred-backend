-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "ban_is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_type" TEXT,
    "ban_reason" TEXT,
    "ban_period" INTEGER,
    "account_created" BOOLEAN NOT NULL DEFAULT false,
    "is_unregistered" BOOLEAN NOT NULL DEFAULT false,
    "unregister_requested" BOOLEAN NOT NULL DEFAULT false,
    "unregister_scheduled_at" TIMESTAMP(3),
    "is_account_created_skipped" BOOLEAN NOT NULL DEFAULT false,
    "is_onboarded" BOOLEAN NOT NULL DEFAULT false,
    "profile_type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legal_company_name" TEXT NOT NULL,
    "country_of_incorporation" TEXT NOT NULL,
    "vat_number" TEXT,
    "company_email" TEXT NOT NULL,
    "use_signup_email" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "location_address" TEXT,
    "location_postal_code" TEXT,
    "location_country" TEXT,
    "legal_rep_first_name" TEXT,
    "legal_rep_last_name" TEXT,
    "legal_rep_email" TEXT,
    "legal_rep_phone_number" TEXT,
    "legal_rep_whatsapp_number" TEXT,
    "use_signup_info" BOOLEAN NOT NULL DEFAULT false,
    "use_signup_phone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consultant_name" TEXT NOT NULL,
    "consultant_email" TEXT NOT NULL,
    "use_signup_email" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "location_address" TEXT,
    "location_postal_code" TEXT,
    "location_country" TEXT,
    "personal_info_first_name" TEXT,
    "personal_info_last_name" TEXT,
    "personal_info_email" TEXT,
    "personal_info_phone_number" TEXT,
    "use_signup_info" BOOLEAN NOT NULL DEFAULT false,
    "use_signup_phone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseUserId_key" ON "users"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_userId_key" ON "companies"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "consultants_userId_key" ON "consultants"("userId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
