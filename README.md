# Mendo Finanzas

Aplicación web para administrar finanzas personales, familiares y compartidas.

## Estado actual

La base técnica incluye:

- Node.js 22, Express 5 y EJS.
- PostgreSQL 17 y Prisma ORM.
- Arquitectura backend modular.
- Registro, login y logout.
- Contraseñas protegidas con Argon2id.
- Sesiones persistidas en PostgreSQL.
- Protección CSRF y rate limiting para autenticación.
- Selección de espacio financiero y contexto de membresía.
- Roles `OWNER`, `ADMIN`, `EDITOR` y `VIEWER`.
- Matriz central de permisos y aislamiento por `householdId`.
- Restricciones de integridad financiera y pruebas automatizadas.

Todavía no están implementados TOTP, recuperación de contraseña, verificación de correo, creación de espacios, administración de integrantes ni los CRUD financieros.

## Requisitos

- Git.
- Node.js 22 o superior.
- npm.
- Docker Desktop con Docker Compose.

Comprueba las herramientas:

```powershell
node --version
npm --version
docker --version
docker compose version
```

## Instalación local

### 1. Clonar el repositorio

```powershell
git clone https://github.com/Mendo0729/Mendo-Finanzas.git
cd Mendo-Finanzas
```

### 2. Crear las variables locales

```powershell
Copy-Item .env.example .env
```

Modifica en `.env`:

- `POSTGRES_PASSWORD`.
- La contraseña incluida en `DATABASE_URL`.
- `SESSION_SECRET` con un valor aleatorio de al menos 32 caracteres.

El archivo `.env` es local y nunca debe subirse al repositorio.

Para generar un secreto compatible con Windows PowerShell:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

### 3. Instalar dependencias

```powershell
npm ci
```

Usa `npm install` únicamente cuando agregues o actualices dependencias y necesites modificar `package-lock.json`.

### 4. Iniciar PostgreSQL

```powershell
npm run db:up
docker compose ps
```

El contenedor local utiliza:

```text
Contenedor: mendo-finanzas-db-dev
Host: localhost
Puerto: 55433
Base: mendo_finanzas_dev
Usuario: mendo_dev
```

### 5. Preparar Prisma

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
```

El seed es idempotente y crea un usuario de desarrollo, un espacio financiero, cinco cuentas, categorías, presupuestos y veinte transacciones.

Credenciales exclusivas para pruebas locales:

```text
Correo: demo@mendofinanzas.local
Contraseña: MendoFinanzasDemo2026!
```

La contraseña se almacena como Argon2id y el script de seed la restablece al valor de demostración. Estas credenciales no deben utilizarse ni cargarse en producción.

### 6. Iniciar la aplicación

```powershell
npm run dev
```

Aplicación:

```text
http://localhost:3000
```

Healthcheck:

```text
http://localhost:3000/health
```

## Autenticación

Rutas disponibles:

```text
GET  /auth/register
POST /auth/register
GET  /auth/login
POST /auth/login
POST /auth/logout
```

Características principales:

- Hash Argon2id con parámetros controlados.
- Contraseñas de 12 a 128 caracteres.
- Mensaje genérico para credenciales incorrectas.
- Regeneración del identificador de sesión después de registro y login.
- Cookie `mendo.sid` con `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Sesiones guardadas en la tabla PostgreSQL `sessions`.
- Tokens CSRF en formularios que modifican estado.
- Límites de intentos para registro y login.

Consulta [docs/authentication.md](docs/authentication.md) para ver las decisiones de seguridad y las limitaciones actuales.

## Espacios financieros y autorización

Rutas disponibles:

```text
GET  /households/select
POST /households/select
GET  /households/current
```

El espacio activo se guarda como `householdId` dentro de la sesión. La aplicación vuelve a consultar `household_members` en cada solicitud, por lo que un espacio manipulado, eliminado o del cual el usuario ya no sea miembro se descarta automáticamente.

Roles disponibles:

| Código | Rol      | Descripción                                                   |
| -----: | -------- | ------------------------------------------------------------- |
|      1 | `OWNER`  | Control total del espacio.                                    |
|      2 | `ADMIN`  | Administración sin eliminación ni transferencia de propiedad. |
|      3 | `EDITOR` | Consulta y modificación de datos financieros.                 |
|      4 | `VIEWER` | Consulta sin modificación.                                    |

Los próximos módulos financieros deben usar:

- `requireHouseholdMembership`.
- `requireHouseholdPermission(...)`.
- `requireHouseholdRole(...)` para reglas estrictamente vinculadas al rol.
- `requireHouseholdScope(...)` cuando una ruta reciba un `householdId`.

Consulta [docs/household-authorization.md](docs/household-authorization.md) para ver la matriz completa y las reglas de aislamiento.

## Validación

Ejecuta todas las comprobaciones:

```powershell
npm run check
npm test
```

Comandos individuales:

```powershell
npm run format:check
npm run lint
npm run prisma:validate
npm run test:unit
npm run test:db
npm run test:http
```

Las pruebas cubren autenticación, CSRF, Argon2id, sesiones PostgreSQL, selección de espacios, permisos por rol y rechazo de accesos entre espacios.

## Estructura principal

```text
.github/workflows/       Integración continua
prisma/                  Esquema, migraciones y seed
src/bootstrap/           Registro de middlewares y rutas
src/config/              Entorno, Prisma y sesiones
src/core/                Seguridad, errores, middlewares y utilidades
src/modules/             Módulos funcionales del backend
src/views/               Vistas y parciales EJS
src/public/              CSS, JavaScript e imágenes públicas
tests/unit/              Pruebas unitarias
tests/http/              Pruebas HTTP
tests/                   Pruebas de integración de base de datos
docs/                    Decisiones técnicas
```

El flujo esperado dentro de un módulo es:

```text
routes -> controller -> service -> repository -> Prisma
```

Consulta [docs/backend-architecture.md](docs/backend-architecture.md) antes de crear un módulo nuevo.

## Administración de PostgreSQL local

Ver logs:

```powershell
npm run db:logs
```

Detener sin borrar datos:

```powershell
npm run db:down
```

Eliminar el contenedor y el volumen:

```powershell
npm run db:reset
```

> `db:reset` elimina todos los datos locales. Después debes iniciar PostgreSQL, aplicar migraciones y ejecutar nuevamente el seed.

## Migraciones

Después de modificar `prisma/schema.prisma`, crea una migración de desarrollo:

```powershell
npm run prisma:migrate -- --name nombre_del_cambio
```

Revisa el SQL generado antes de confirmarlo. En CI y producción se utiliza únicamente:

```powershell
npm run prisma:deploy
```

## Integración continua

GitHub Actions ejecuta:

1. `npm ci` desde el lockfile.
2. Generación y validación de Prisma Client.
3. Migraciones sobre PostgreSQL 17.
4. Seed ejecutado dos veces para validar idempotencia.
5. Prettier y ESLint.
6. Pruebas unitarias.
7. Pruebas de integración de base de datos.
8. Pruebas HTTP.
9. Smoke tests de `/`, `/health` y `/auth/login`.

Los workflows mantienen permisos de contenido en modo de solo lectura.
