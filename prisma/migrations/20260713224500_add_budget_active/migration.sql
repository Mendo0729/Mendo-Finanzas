ALTER TABLE "budgets"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "budgets_household_id_month_start_active_idx"
ON "budgets"("household_id", "month_start", "active");
