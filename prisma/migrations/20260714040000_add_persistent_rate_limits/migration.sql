CREATE TABLE "rate_limit_buckets" (
  "scope" VARCHAR(80) NOT NULL,
  "key_hash" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "reset_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("scope", "key_hash"),
  CONSTRAINT "rate_limit_buckets_attempts_check" CHECK ("attempts" > 0)
);

CREATE INDEX "rate_limit_buckets_reset_at_idx"
  ON "rate_limit_buckets"("reset_at");
