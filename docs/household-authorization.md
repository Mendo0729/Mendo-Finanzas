# Contexto de espacios y autorización

## Objetivo

Cada cuenta, categoría, movimiento, presupuesto y registro de auditoría pertenece a un espacio financiero. La aplicación no debe aceptar un `householdId` enviado por el navegador como prueba de autorización.

El contexto activo se obtiene mediante esta secuencia:

1. El usuario inicia sesión.
2. Selecciona uno de sus espacios desde `/households/select`.
3. La sesión guarda únicamente `householdId` y `householdSelectedAt`.
4. En cada solicitud, `loadHouseholdContext` consulta nuevamente `household_members` usando la combinación `userId + householdId`.
5. Si la membresía no existe, la selección se elimina de la sesión.
6. Los módulos financieros reciben el espacio, la membresía, el rol y los permisos desde `request.context`.

## Roles

| Código | Rol | Alcance |
|---:|---|---|
| 1 | `OWNER` | Control total, incluida eliminación y transferencia de propiedad. |
| 2 | `ADMIN` | Administración del espacio, integrantes y datos financieros, sin eliminar ni transferir la propiedad. |
| 3 | `EDITOR` | Consulta y modificación de cuentas, categorías, movimientos y presupuestos. |
| 4 | `VIEWER` | Consulta de información sin permisos de modificación. |

La fuente de verdad está en `src/modules/households/household.roles.js`.

## Matriz resumida

| Capacidad | Owner | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|:---:|
| Ver espacio | Sí | Sí | Sí | Sí |
| Editar espacio | Sí | Sí | No | No |
| Eliminar espacio | Sí | No | No | No |
| Transferir propiedad | Sí | No | No | No |
| Ver integrantes | Sí | Sí | Sí | Sí |
| Administrar integrantes | Sí | Sí | No | No |
| Ver datos financieros | Sí | Sí | Sí | Sí |
| Modificar datos financieros | Sí | Sí | Sí | No |
| Consultar auditoría | Sí | Sí | No | No |

## Middlewares disponibles

### `loadHouseholdContext`

Se ejecuta globalmente después de `loadCurrentUser`. Carga la membresía real y expone:

```text
request.context.household
request.context.membership
request.context.householdRole
request.context.householdPermissions
```

Las vistas reciben `currentHousehold`, `currentHouseholdRole` y `householdPermissions`.

### `requireHouseholdMembership`

Exige un espacio activo con membresía vigente. Las solicitudes de lectura sin selección se redirigen a `/households/select`; las escrituras reciben `HOUSEHOLD_REQUIRED`.

### `requireHouseholdRole(...roles)`

Restringe una ruta a uno o varios roles concretos. Debe reservarse para reglas vinculadas directamente al rol, como transferir la propiedad.

### `requireHouseholdPermission(permission)`

Es la opción preferida para funcionalidades normales. Evita duplicar comparaciones de roles en cada módulo.

```js
router.post(
  '/transactions',
  requireHouseholdMembership,
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE),
  controller,
);
```

### `requireHouseholdScope(resolveHouseholdId)`

Compara el `householdId` de un recurso o parámetro con el espacio activo. Devuelve `HOUSEHOLD_SCOPE_DENIED` sin revelar si el recurso de otro espacio existe.

## Reglas para repositorios financieros

- Toda consulta debe incluir `householdId: request.context.household.id`.
- No buscar primero un recurso por su identificador y validar después; la consulta debe filtrar simultáneamente por identificador y espacio.
- No usar `createdBy` como sustituto de la membresía.
- No guardar roles ni permisos como fuente de verdad dentro de la sesión.
- Un cambio de rol debe reflejarse en la siguiente solicitud sin requerir un nuevo login.
- Los errores de aislamiento no deben revelar nombres, saldos ni existencia de datos pertenecientes a otro espacio.

## Pruebas

Las pruebas automatizadas validan:

- La matriz completa de roles.
- Rechazo por permiso o rol insuficiente.
- Rechazo de `householdId` distinto al contexto activo.
- Listado exclusivo de espacios donde el usuario es miembro.
- Imposibilidad de seleccionar un espacio ajeno.
- Persistencia del espacio autorizado en PostgreSQL.
- Eliminación automática de una selección manipulada en la sesión.
