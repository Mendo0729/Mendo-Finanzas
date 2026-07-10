-- Keep historical transaction categories intact.
-- Categories are deactivated through the application instead of deleted.
ALTER TABLE "transactions"
DROP CONSTRAINT "transactions_category_id_fkey";

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
