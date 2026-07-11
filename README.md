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
- Restricciones de integridad financiera y pruebas automatizadas.

Todavía no están implementados TOTP, recuperación de contraseña, verificación de correo, contexto de espacios financieros ni los CRUD financieros.

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

Para generar un secreto desde PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
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

El usuario `demo@mendofinanzas.local` conserva los datos financieros de demostración, pero su contraseña histórica no es un hash válido. Para probar registro y login crea una cuenta nueva desde la aplicación.

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

Las pruebas HTTP cubren registro, CSRF, Argon2id, persistencia de sesiones, logout, credenciales incorrectas y regeneración de sesión.

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
