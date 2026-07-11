# Cuentas y categorías

## Alcance

El módulo permite consultar, crear, editar, activar y desactivar cuentas y categorías dentro del espacio financiero activo.

No existe borrado físico. Las consultas y mutaciones siempre utilizan el `householdId` revalidado por el contexto de sesión.

## Permisos

- `accounts:view`: consultar cuentas.
- `accounts:manage`: crear, editar, activar y desactivar cuentas.
- `categories:view`: consultar categorías.
- `categories:manage`: crear, editar, activar y desactivar categorías.

Los roles `OWNER`, `ADMIN` y `EDITOR` administran estos recursos. `VIEWER` solo puede consultarlos.

## Cuentas

Tipos disponibles:

1. Efectivo.
2. Cuenta corriente.
3. Cuenta de ahorro.
4. Tarjeta de crédito.
5. Billetera digital.

Las tarjetas de crédito requieren límite, día de corte y día de pago. Para los demás tipos esos campos se almacenan como `null`.

El nombre es único dentro del espacio financiero. El saldo inicial usa `Decimal(14,2)` y no representa el saldo actual.

## Categorías

Tipos disponibles:

1. Ingreso.
2. Gasto.

El nombre es único por tipo dentro del espacio. Las categorías creadas por el usuario no son predeterminadas.

Las categorías predeterminadas no pueden cambiar de tipo ni desactivarse. Una categoría con movimientos o presupuestos asociados tampoco puede desactivarse.

## Auditoría

Cada creación, edición, activación o desactivación genera un registro en `audit_logs` dentro de la misma transacción que modifica el recurso.

La auditoría incluye:

- Usuario.
- Espacio financiero.
- Acción.
- Tipo e identificador de entidad.
- IP y agente de usuario cuando están disponibles.
- Valores relevantes antes y después del cambio.

## Aislamiento

Los repositorios buscan recursos mediante la combinación de `id` y `householdId`. Un identificador válido de otro espacio se responde como recurso inexistente y no revela información externa.
