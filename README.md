# Mendo Finanzas

Aplicación web para administrar finanzas personales, familiares y compartidas.

## Arquitectura

```text
finanzas.mendotech.lat
        │
        ▼
Cloudflare — DNS, proxy y TLS
        │
        ▼
Render — Node.js, Express y EJS
        │
        ▼
Aiven PostgreSQL
```

Durante el desarrollo se utiliza PostgreSQL 17 local mediante Docker Compose. Las migraciones Prisma serán las mismas en desarrollo y producción.

## Tecnologías iniciales

- Node.js 22 o superior.
- Express 5.
- EJS.
- Prisma ORM.
- PostgreSQL 17.
- Docker Compose.
- Bootstrap 5.
- ESLint y Prettier.
- GitHub Actions.

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

Para trabajar con la rama inicial mientras el pull request siga abierto:

```powershell
git switch feat/initial-project-structure
```

### 2. Crear las variables locales

```powershell
Copy-Item .env.example .env
```

Cambia `POSTGRES_PASSWORD` y actualiza la misma contraseña dentro de `DATABASE_URL`. El archivo `.env` es local y nunca debe subirse al repositorio.

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

El seed es seguro de ejecutar varias veces y crea:

- Un usuario de desarrollo.
- Un espacio financiero.
- Cinco cuentas.
- Categorías iniciales.
- Presupuestos del mes actual.
- Veinte transacciones de ejemplo.

El valor de contraseña incluido en el seed no es un hash válido y no permite autenticarse. La autenticación se implementará posteriormente con Argon2id.

### 6. Validar el proyecto

```powershell
npm run check
```

También puedes ejecutar las validaciones individualmente:

```powershell
npm run format:check
npm run lint
npm run prisma:validate
```

### 7. Iniciar la aplicación

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

El healthcheck devuelve HTTP `200` cuando PostgreSQL está disponible y HTTP `503` cuando la conexión falla.

## Prisma Studio

```powershell
npm run prisma:studio
```

Prisma Studio se abre normalmente en:

```text
http://localhost:5555
```

## Cambios futuros al esquema

Después de modificar `prisma/schema.prisma`, crea una migración de desarrollo con un nombre descriptivo:

```powershell
npm run prisma:migrate -- --name nombre_del_cambio
```

Revisa el SQL generado dentro de `prisma/migrations` antes de confirmarlo en Git.

En producción se utilizará únicamente:

```powershell
npm run prisma:deploy
```

No se ejecutará `prisma migrate dev` en Render.

## Administración de PostgreSQL local

### Ver logs

```powershell
npm run db:logs
```

### Detener sin borrar datos

```powershell
npm run db:down
```

### Volver a iniciar

```powershell
npm run db:up
```

### Eliminar la base local

```powershell
npm run db:reset
```

> `db:reset` elimina el contenedor y el volumen persistente. Todos los datos locales se perderán. Después tendrás que iniciar PostgreSQL y aplicar nuevamente las migraciones y el seed.

## Modelo de datos aprobado

El esquema inicial contiene:

- `users`.
- `user_mfa`.
- `recovery_codes`.
- `households`.
- `household_members`.
- `accounts`.
- `categories`.
- `transactions`.
- `budgets`.
- `auth_tokens`.
- `sessions`.
- `audit_logs`.

Decisiones principales:

- Identificadores internos `BIGINT`.
- Dinero con `DECIMAL(14,2)`, nunca `FLOAT`.
- Saldo calculado desde el saldo inicial y las transacciones.
- Transferencias representadas por dos movimientos enlazados mediante `transfer_group_id`.
- Eliminación lógica de transacciones con `deleted_at`.
- Datos financieros aislados mediante `household_id`.
- Secretos TOTP cifrados antes de almacenarse.
- Códigos de recuperación almacenados como hash.
- Archivos, recibos e imágenes fuera de PostgreSQL.
- Categorías referenciadas por movimientos protegidas contra eliminación física.

La migración inicial incluye restricciones `CHECK` para roles, tipos de cuenta, categorías, estados, montos positivos, días válidos y consistencia de transferencias.

## Estructura principal

```text
.github/workflows/      Integración continua
prisma/                 Esquema, migraciones y seed
src/config/             Entorno y conexión a la base
src/controllers/        Controladores HTTP
src/middleware/         Manejo transversal de solicitudes
src/routes/             Rutas HTTP
src/services/           Reglas y servicios de negocio
src/validators/         Validación de entradas
src/views/              Vistas y parciales EJS
src/public/             CSS, JavaScript e imágenes públicas
src/utils/              Utilidades compartidas
tests/                  Pruebas automatizadas
```

## Integración continua

El workflow de GitHub Actions valida cada pull request mediante:

1. Instalación exacta desde `package-lock.json`.
2. Generación y validación de Prisma Client.
3. Aplicación de migraciones en PostgreSQL 17.
4. Ejecución del seed.
5. Validación de formato y ESLint.
6. Prueba de `/` y `/health` con la aplicación iniciada.

## Estado del proyecto

La infraestructura inicial, el modelo de datos, las migraciones, el seed y el healthcheck están preparados. Todavía no están implementados:

- Registro e inicio de sesión.
- Argon2id.
- TOTP funcional.
- Códigos de recuperación funcionales.
- Sesiones de usuario.
- CRUD de cuentas y movimientos.
- Dashboard financiero.
- Despliegue en Render.
- Conexión con Aiven.

Estas funciones se incorporarán por etapas en ramas y pull requests independientes.
