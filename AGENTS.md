# Mendo Finanzas — Reglas del repositorio

## Arquitectura

- Mantener un monolito modular organizado por funcionalidad dentro de `src/modules`.
- Usar JavaScript moderno con ES Modules.
- Usar nombres técnicos, variables, funciones y archivos en inglés.
- Usar mensajes visibles para el usuario en español.
- Mantener `src/app.js` separado de `src/server.js`.
- Registrar middlewares y rutas desde `src/bootstrap`.
- Mantener el flujo `routes -> controller -> service -> repository -> Prisma`.
- Los controladores no deben importar Prisma ni contener reglas financieras.
- Los repositorios deben contener consultas explícitas; no crear un repositorio genérico global.
- Crear únicamente las capas que el módulo necesite realmente.
- Consultar `docs/backend-architecture.md` antes de incorporar un módulo nuevo.
- No desplegar ni conectarse a Aiven, Render o Cloudflare sin una instrucción explícita.

## Seguridad

- No guardar secretos, contraseñas, tokens ni archivos `.env` en el repositorio.
- No almacenar secretos TOTP en texto plano.
- Los códigos de recuperación deben almacenarse como hash.
- No registrar contraseñas, tokens, secretos TOTP, cookies ni cuerpos sensibles en logs.
- Toda consulta financiera debe limitarse por `householdId` y membresía.
- No confiar únicamente en identificadores enviados por el navegador.
- Propagar el `requestId` en errores y registros sin aceptar valores de cabecera inválidos.
- Almacenar contraseñas únicamente con Argon2id.
- Guardar en la sesión solo identificadores y datos mínimos; nunca objetos completos de usuario.
- Regenerar la sesión después del registro o login y destruirla al cerrar sesión.
- Proteger con CSRF toda operación web que modifique estado.
- Aplicar rate limiting antes de ejecutar validaciones criptográficas costosas.
- Revalidar el espacio seleccionado contra `household_members` en cada solicitud.
- Usar `HOUSEHOLD_ROLES` y `HOUSEHOLD_PERMISSIONS`; no comparar números de rol dispersos en el código.
- Preferir permisos sobre comparaciones de rol para proteger funcionalidades normales.
- No revelar si un recurso perteneciente a otro espacio existe.

## Contexto financiero

- Obtener el espacio activo desde `request.context.household`, nunca directamente desde el cuerpo o los parámetros.
- Exigir `requireHouseholdMembership` antes de acceder a datos financieros.
- Aplicar `requireHouseholdPermission` o `requireHouseholdRole` según la acción.
- Toda consulta de recurso debe filtrar simultáneamente por su identificador y `householdId`.
- Usar `requireHouseholdScope` cuando una ruta reciba explícitamente un `householdId`.
- No almacenar roles o permisos en la sesión como fuente de verdad.
- Consultar `docs/household-authorization.md` antes de crear rutas financieras.

## Datos financieros

- No usar `Float` ni `Double` para dinero; usar `Decimal(14,2)`.
- No almacenar el saldo actual como fuente primaria. Debe calcularse desde el saldo inicial y las transacciones.
- No realizar borrado físico de transacciones; usar `deletedAt`.
- Las transferencias se representan mediante dos transacciones relacionadas por `transferGroupId`.
- No guardar recibos, imágenes, PDF, reportes o copias de seguridad en PostgreSQL.
- Mantener controlado el crecimiento de `transactions` y `audit_logs`.
- Las categorías y cuentas se desactivan; no deben borrarse cuando tengan movimientos asociados.

## Base de datos

- Toda modificación de `prisma/schema.prisma` debe incluir una migración revisable.
- No editar migraciones que ya hayan sido aplicadas en producción.
- Usar `prisma migrate dev` solamente en desarrollo.
- Usar `prisma migrate deploy` en producción y CI.
- Revisar restricciones `CHECK`, índices y claves foráneas antes de aprobar una migración.
- El seed debe ser idempotente y contener únicamente datos de desarrollo.

## Calidad

- Ejecutar `npm run check` antes de considerar una tarea terminada.
- Ejecutar las pruebas unitarias, de integración o HTTP relevantes para el cambio.
- Mantener actualizado `package-lock.json` cuando cambien dependencias.
- Agregar pruebas para nuevas reglas de negocio y controles de autorización.
- Agregar pruebas de aislamiento entre espacios para cada módulo financiero.
- No simular validaciones que no pudieron ejecutarse.
- Mantener el workflow de CI en modo de solo lectura.

## Alcance actual

- Registro, login, logout, Argon2id, sesiones PostgreSQL, CSRF y rate limiting están implementados.
- Selección de espacio, contexto de membresía, roles y matriz de permisos están implementados.
- TOTP, códigos de recuperación, verificación de correo y restablecimiento de contraseña aún no están implementados.
- La creación de espacios y la administración de integrantes todavía no están implementadas.
- No comenzar módulos financieros adicionales sin una tarea específica y un alcance definido.
