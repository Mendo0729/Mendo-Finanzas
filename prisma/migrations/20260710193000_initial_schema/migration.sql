-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "email_verified_at" TIMESTAMP(6) WITH TIME ZONE,
    "last_login_at" TIMESTAMP(6) WITH TIME ZONE,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_status_check" CHECK ("status" IN (0, 1, 2))
);

-- CreateTable
CREATE TABLE "user_mfa" (
    "user_id" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret_encrypted" BYTEA,
    "enabled_at" TIMESTAMP(6) WITH TIME ZONE,
    "last_verified_at" TIMESTAMP(6) WITH TIME ZONE,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mfa_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_mfa_enabled_check" CHECK (
        "enabled" = false
        OR ("totp_secret_encrypted" IS NOT NULL AND "enabled_at" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMP(6) WITH TIME ZONE,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "households_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateTable
CREATE TABLE "household_members" (
    "household_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" SMALLINT NOT NULL,
    "joined_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("household_id", "user_id"),
    CONSTRAINT "household_members_role_check" CHECK ("role" IN (1, 2, 3, 4))
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" BIGSERIAL NOT NULL,
    "household_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "account_type" SMALLINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "initial_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(14,2),
    "closing_day" SMALLINT,
    "payment_day" SMALLINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accounts_type_check" CHECK ("account_type" IN (1, 2, 3, 4, 5)),
    CONSTRAINT "accounts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "accounts_credit_limit_check" CHECK ("credit_limit" IS NULL OR "credit_limit" >= 0),
    CONSTRAINT "accounts_closing_day_check" CHECK ("closing_day" IS NULL OR "closing_day" BETWEEN 1 AND 31),
    CONSTRAINT "accounts_payment_day_check" CHECK ("payment_day" IS NULL OR "payment_day" BETWEEN 1 AND 31)
);

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "household_id" BIGINT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "category_type" SMALLINT NOT NULL,
    "icon" VARCHAR(40),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_type_check" CHECK ("category_type" IN (1, 2))
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" BIGSERIAL NOT NULL,
    "household_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "category_id" BIGINT,
    "created_by" BIGINT NOT NULL,
    "transaction_type" SMALLINT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(1000),
    "transaction_date" DATE NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "transfer_group_id" UUID,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6) WITH TIME ZONE,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transactions_type_check" CHECK ("transaction_type" IN (1, 2, 3, 4)),
    CONSTRAINT "transactions_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "transactions_status_check" CHECK ("status" IN (0, 1, 2)),
    CONSTRAINT "transactions_consistency_check" CHECK (
        ("transaction_type" IN (1, 2) AND "category_id" IS NOT NULL AND "transfer_group_id" IS NULL)
        OR
        ("transaction_type" IN (3, 4) AND "category_id" IS NULL AND "transfer_group_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" BIGSERIAL NOT NULL,
    "household_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "month_start" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budgets_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "budgets_month_start_check" CHECK (EXTRACT(DAY FROM "month_start") = 1)
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_type" SMALLINT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "used_at" TIMESTAMP(6) WITH TIME ZONE,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_tokens_type_check" CHECK ("token_type" IN (1, 2, 3, 4))
);

-- CreateTable
CREATE TABLE "sessions" (
    "sid" VARCHAR(255) NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "household_id" BIGINT,
    "action" SMALLINT NOT NULL,
    "entity_type" SMALLINT,
    "entity_id" BIGINT,
    "ip_address" INET,
    "user_agent" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "recovery_codes_user_id_idx" ON "recovery_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "households_created_by_name_key" ON "households"("created_by", "name");

-- CreateIndex
CREATE INDEX "household_members_user_id_household_id_idx" ON "household_members"("user_id", "household_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_household_id_name_key" ON "accounts"("household_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_household_id_category_type_name_key" ON "categories"("household_id", "category_type", "name");

-- CreateIndex
CREATE INDEX "transactions_household_id_transaction_date_idx" ON "transactions"("household_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_account_id_transaction_date_idx" ON "transactions"("account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_category_id_transaction_date_idx" ON "transactions"("category_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_transfer_group_id_idx" ON "transactions"("transfer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_household_id_category_id_month_start_key" ON "budgets"("household_id", "category_id", "month_start");

-- CreateIndex
CREATE INDEX "budgets_household_id_month_start_idx" ON "budgets"("household_id", "month_start");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");

-- CreateIndex
CREATE INDEX "audit_logs_household_id_created_at_idx" ON "audit_logs"("household_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "user_mfa"
ADD CONSTRAINT "user_mfa_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes"
ADD CONSTRAINT "recovery_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households"
ADD CONSTRAINT "households_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members"
ADD CONSTRAINT "household_members_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members"
ADD CONSTRAINT "household_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts"
ADD CONSTRAINT "accounts_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories"
ADD CONSTRAINT "categories_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets"
ADD CONSTRAINT "budgets_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets"
ADD CONSTRAINT "budgets_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens"
ADD CONSTRAINT "auth_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
