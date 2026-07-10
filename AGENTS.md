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
- No simular validaciones que no pudieron ejecutarse.
- Mantener el workflow de CI en modo de solo lectura.

## Alcance actual

- La autenticación con Argon2id, sesiones, TOTP y códigos de recuperación todavía no está implementada.
- No comenzar módulos financieros adicionales sin una tarea específica y un alcance definido.
