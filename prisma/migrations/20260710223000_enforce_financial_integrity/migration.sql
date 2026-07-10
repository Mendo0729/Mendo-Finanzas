-- Enforce tenant isolation and financial business rules that cannot be
-- represented completely in the Prisma schema.

CREATE OR REPLACE FUNCTION "validate_transaction_integrity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    category_kind SMALLINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "accounts"
        WHERE "id" = NEW."account_id"
          AND "household_id" = NEW."household_id"
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'transactions_account_household_check',
            MESSAGE = 'La cuenta no pertenece al espacio financiero de la transacción.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "household_members"
        WHERE "household_id" = NEW."household_id"
          AND "user_id" = NEW."created_by"
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'transactions_creator_membership_check',
            MESSAGE = 'El usuario creador no pertenece al espacio financiero.';
    END IF;

    IF NEW."category_id" IS NOT NULL THEN
        SELECT "category_type"
        INTO category_kind
        FROM "categories"
        WHERE "id" = NEW."category_id"
          AND "household_id" = NEW."household_id";

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                CONSTRAINT = 'transactions_category_household_check',
                MESSAGE = 'La categoría no pertenece al espacio financiero de la transacción.';
        END IF;

        IF NEW."transaction_type" IN (1, 2)
           AND category_kind <> NEW."transaction_type" THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                CONSTRAINT = 'transactions_category_type_check',
                MESSAGE = 'El tipo de categoría no coincide con el tipo de transacción.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "transactions_integrity_trigger"
BEFORE INSERT OR UPDATE OF
    "household_id",
    "account_id",
    "category_id",
    "created_by",
    "transaction_type"
ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION "validate_transaction_integrity"();

CREATE OR REPLACE FUNCTION "validate_budget_integrity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    category_kind SMALLINT;
BEGIN
    SELECT "category_type"
    INTO category_kind
    FROM "categories"
    WHERE "id" = NEW."category_id"
      AND "household_id" = NEW."household_id";

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'budgets_category_household_check',
            MESSAGE = 'La categoría no pertenece al espacio financiero del presupuesto.';
    END IF;

    IF category_kind <> 2 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'budgets_expense_category_check',
            MESSAGE = 'Los presupuestos solo pueden usar categorías de gasto.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "budgets_integrity_trigger"
BEFORE INSERT OR UPDATE OF "household_id", "category_id"
ON "budgets"
FOR EACH ROW
EXECUTE FUNCTION "validate_budget_integrity"();

CREATE UNIQUE INDEX "transactions_transfer_group_type_key"
ON "transactions"("transfer_group_id", "transaction_type")
WHERE "transfer_group_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION "assert_transfer_group_integrity"(target_group UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    active_count INTEGER;
    transfer_out_count INTEGER;
    transfer_in_count INTEGER;
    household_count INTEGER;
    account_count INTEGER;
    amount_count INTEGER;
    date_count INTEGER;
    status_count INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE "deleted_at" IS NULL),
        COUNT(*) FILTER (
            WHERE "deleted_at" IS NULL
              AND "transaction_type" = 3
        ),
        COUNT(*) FILTER (
            WHERE "deleted_at" IS NULL
              AND "transaction_type" = 4
        ),
        COUNT(DISTINCT "household_id") FILTER (WHERE "deleted_at" IS NULL),
        COUNT(DISTINCT "account_id") FILTER (WHERE "deleted_at" IS NULL),
        COUNT(DISTINCT "amount") FILTER (WHERE "deleted_at" IS NULL),
        COUNT(DISTINCT "transaction_date") FILTER (WHERE "deleted_at" IS NULL),
        COUNT(DISTINCT "status") FILTER (WHERE "deleted_at" IS NULL)
    INTO
        active_count,
        transfer_out_count,
        transfer_in_count,
        household_count,
        account_count,
        amount_count,
        date_count,
        status_count
    FROM "transactions"
    WHERE "transfer_group_id" = target_group;

    IF active_count = 0 THEN
        RETURN;
    END IF;

    IF active_count <> 2
       OR transfer_out_count <> 1
       OR transfer_in_count <> 1
       OR household_count <> 1
       OR account_count <> 2
       OR amount_count <> 1
       OR date_count <> 1
       OR status_count <> 1 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            CONSTRAINT = 'transactions_transfer_group_integrity_check',
            MESSAGE = 'Una transferencia debe tener dos movimientos equivalentes y opuestos.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "validate_transfer_group_trigger"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."transfer_group_id" IS NOT NULL THEN
            PERFORM "assert_transfer_group_integrity"(NEW."transfer_group_id");
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."transfer_group_id" IS NOT NULL THEN
            PERFORM "assert_transfer_group_integrity"(OLD."transfer_group_id");
        END IF;
    ELSE
        IF OLD."transfer_group_id" IS NOT NULL THEN
            PERFORM "assert_transfer_group_integrity"(OLD."transfer_group_id");
        END IF;

        IF NEW."transfer_group_id" IS NOT NULL
           AND NEW."transfer_group_id" IS DISTINCT FROM OLD."transfer_group_id" THEN
            PERFORM "assert_transfer_group_integrity"(NEW."transfer_group_id");
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "transactions_transfer_group_integrity_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "transactions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_transfer_group_trigger"();

CREATE OR REPLACE FUNCTION "prevent_transaction_hard_delete"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'transactions_soft_delete_only',
        MESSAGE = 'Las transacciones deben eliminarse lógicamente mediante deleted_at.';
END;
$$;

CREATE TRIGGER "transactions_prevent_hard_delete_trigger"
BEFORE DELETE
ON "transactions"
FOR EACH ROW
EXECUTE FUNCTION "prevent_transaction_hard_delete"();
