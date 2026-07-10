# Arquitectura del backend

Mendo Finanzas utiliza un monolito modular con Express, EJS, Prisma y PostgreSQL. La organización principal es por funcionalidad y cada módulo debe mantener separadas las responsabilidades HTTP, negocio y persistencia.

## Estructura

```text
src/
├── app.js
├── server.js
├── bootstrap/
├── config/
├── core/
│   ├── errors/
│   ├── middleware/
│   ├── services/
│   └── utils/
└── modules/
    └── nombre-del-modulo/
        ├── nombre.controller.js
        ├── nombre.routes.js
        ├── nombre.service.js
        ├── nombre.repository.js
        ├── nombre.schemas.js
        └── nombre.presenter.js
```

No todos los módulos necesitan todas las capas. Solo deben crearse archivos con una responsabilidad real.

## Dependencias permitidas

```text
routes -> middleware -> controller -> service -> repository -> Prisma
                                      |
                                      +-> presenter
```

- Las rutas declaran endpoints y middlewares.
- Los controladores traducen HTTP a llamadas de aplicación.
- Los servicios aplican reglas de negocio y coordinan transacciones.
- Los repositorios contienen consultas Prisma.
- Los presenters preparan datos para vistas o respuestas.
- Los controladores no pueden importar Prisma directamente.
- Los repositorios no pueden decidir permisos ni reglas de interfaz.

## Contexto de solicitud

`requestContext` crea o acepta un identificador seguro y lo expone en:

- `request.context.requestId`
- `response.locals.requestId`
- Cabecera `X-Request-ID`

El logger registra método, ruta, estado y duración, pero nunca cuerpos, contraseñas, cookies, tokens ni secretos.

## Errores

Los errores esperados deben extender `AppError`. El manejador central decide el código HTTP, registra el incidente y evita exponer detalles internos. Los recursos ajenos a un espacio financiero deberán responder como no encontrados.

## Validación

El middleware `validate` acepta funciones o esquemas con método `parse()`. Este contrato permite incorporar Zod sin acoplar rutas o controladores a una implementación concreta. Los datos validados se almacenan en `request.validated`.

## Reglas financieras futuras

- Toda consulta financiera debe incluir `householdId`.
- Los repositorios deben excluir `deletedAt` por defecto.
- El dinero se procesa con `Decimal`, nunca con `Number`.
- Las transferencias se crean y modifican en una transacción atómica.
- Cada mutación financiera genera auditoría dentro de la misma transacción.

## Incorporar un módulo

1. Crear la carpeta dentro de `src/modules`.
2. Definir rutas mínimas y un controlador.
3. Agregar servicio cuando exista lógica de negocio.
4. Agregar repositorio cuando se necesite persistencia.
5. Registrar el router en `bootstrap/register-routes.js`.
6. Agregar pruebas unitarias, de integración o HTTP según corresponda.
