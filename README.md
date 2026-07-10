# Mendo Finanzas

Aplicación web para administrar finanzas personales, familiares y compartidas.

## Arquitectura

```text
Cloudflare + finanzas.mendotech.lat
        ↓
Render — Node.js, Express y EJS
        ↓
Aiven PostgreSQL
```

Durante el desarrollo se utiliza PostgreSQL 17 local mediante Docker Compose.

## Tecnologías iniciales

- Node.js 22+
- Express 5
- EJS
- Prisma ORM
- PostgreSQL 17
- Docker Compose
- Bootstrap 5

## Desarrollo local

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Aplicación: `http://localhost:3000`

Healthcheck: `http://localhost:3000/health`

## Base de datos aprobada

El esquema inicial incluye usuarios, TOTP, códigos de recuperación, espacios financieros, membresías, cuentas, categorías, transacciones, presupuestos, tokens, sesiones y auditoría.

Los montos utilizan `Decimal(14,2)`. El saldo actual no se almacena como fuente primaria y las transacciones utilizan eliminación lógica.

## Estado

La autenticación, TOTP y los módulos financieros todavía no están implementados. Esta rama prepara la infraestructura inicial del proyecto.
