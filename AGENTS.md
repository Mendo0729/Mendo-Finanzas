# Reglas del repositorio

## Arquitectura y código

- Mantener una arquitectura MVC modular con rutas, controladores, servicios, validadores y middleware separados.
- Usar JavaScript moderno con ES Modules.
- Usar nombres técnicos, variables y funciones en inglés.
- Usar mensajes visibles para el usuario en español.
- Mantener `src/app.js` independiente del arranque de `src/server.js`.
- Ejecutar lint y las validaciones disponibles antes de dar una tarea por terminada.

## Seguridad

- No guardar secretos, contraseñas, cadenas de conexión ni archivos `.env` en el repositorio.
- No guardar secretos TOTP en texto plano.
- No desplegar ni conectarse a Aiven, Render o Cloudflare sin una instrucción explícita.
- No mostrar detalles internos ni secretos en respuestas de error.

## Datos financieros

- No usar `Float` o `Double` para dinero; usar `Decimal(14,2)`.
- No almacenar el saldo actual como fuente primaria. Calcularlo desde el saldo inicial y los movimientos.
- Toda consulta financiera debe limitarse por `householdId` y validar la membresía del usuario.
- No realizar borrado físico de transacciones; usar `deletedAt`.
- Las transferencias se representan con dos movimientos unidos por `transferGroupId`.
- No guardar recibos, imágenes, PDF ni copias de seguridad dentro de PostgreSQL.
- Mantener controlado el crecimiento de `transactions` y `audit_logs`.
- No registrar visitas, recursos estáticos ni solicitudes HTTP exitosas en `audit_logs`.

## Base de datos

- Mantener las migraciones de Prisma versionadas.
- No modificar una migración ya aplicada en producción; crear una nueva.
- Usar `prisma migrate dev` solo en desarrollo y `prisma migrate deploy` en producción.
- Mantener índices justificados y evitar índices redundantes.
