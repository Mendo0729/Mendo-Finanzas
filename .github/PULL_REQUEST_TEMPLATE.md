## Objetivo

Describe el problema o capacidad que resuelve este cambio.

## Cambios

- Describe los cambios principales.

## Validaciones

- [ ] `npm run check`
- [ ] Migraciones aplicadas en PostgreSQL local o CI
- [ ] Seed ejecutado cuando corresponde
- [ ] Pruebas funcionales relevantes
- [ ] No se incluyeron secretos ni archivos `.env`

## Base de datos

- [ ] No cambia el esquema
- [ ] Incluye una migración revisable
- [ ] Se revisaron restricciones, índices y claves foráneas

## Seguridad y aislamiento

- [ ] Las consultas financieras validan `householdId` y membresía
- [ ] No se registran datos sensibles
- [ ] No se realiza borrado físico de transacciones

## Fuera de alcance

Indica lo que no se incluye en este pull request.
