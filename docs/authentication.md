# Autenticación y sesiones

## Flujo implementado

Mendo Finanzas permite registrar usuarios, iniciar sesión y cerrar sesión mediante formularios HTML. Las rutas públicas están bajo `/auth`.

- `GET /auth/register` y `POST /auth/register`.
- `GET /auth/login` y `POST /auth/login`.
- `POST /auth/logout`.

Después de un registro o login correcto, el identificador de sesión se regenera para impedir fijación de sesión. La sesión almacena únicamente identificadores y marcas de tiempo mínimas: `userId`, `authenticatedAt` y, después de una selección válida, `householdId` y `householdSelectedAt`. Nunca se guarda el usuario, la membresía, el rol, los permisos ni la contraseña completa.

## Contraseñas

Las contraseñas se procesan con Argon2id usando 19 MiB de memoria, dos iteraciones, un hilo y una salida de 32 bytes. Los formularios aceptan contraseñas de 12 a 128 caracteres y permiten frases largas sin imponer reglas de composición arbitrarias.

Los mensajes de login son genéricos para no confirmar si una dirección de correo existe. Cuando el correo no existe, se ejecuta una verificación Argon2id contra un hash ficticio para reducir diferencias de tiempo observables.

## Sesiones PostgreSQL

`express-session` utiliza `PrismaSessionStore`, que persiste los datos en la tabla `sessions` ya definida en Prisma.

Configuración principal:

- Cookie `mendo.sid`.
- `HttpOnly` habilitado.
- `SameSite=Lax`.
- `Secure` en producción.
- Duración máxima de siete días con renovación durante la actividad.
- `saveUninitialized=false` y `resave=false`.

`SESSION_SECRET` es obligatorio, debe tener al menos 32 caracteres y nunca debe almacenarse en el repositorio.

El `householdId` guardado en sesión no concede acceso por sí mismo. `loadHouseholdContext` vuelve a consultar la membresía en PostgreSQL durante cada solicitud y elimina selecciones inválidas o ajenas.

## CSRF

Cada formulario de autenticación y selección de espacio recibe un token aleatorio asociado a la sesión. Los métodos que modifican estado verifican `_csrf` antes de ejecutar validaciones o trabajo criptográfico. Un token ausente o inválido devuelve HTTP 403.

## Rate limiting

- Login: cinco intentos por combinación de IP y correo cada 15 minutos.
- Registro: tres intentos por IP cada hora.

El almacenamiento actual es en memoria y corresponde al despliegue de una sola instancia. Antes de escalar horizontalmente debe sustituirse por un almacenamiento compartido.

## Datos de desarrollo

El usuario `demo@mendofinanzas.local` creado por el seed conserva datos financieros de demostración, pero su contraseña histórica no es un hash válido. Para probar autenticación se debe registrar un usuario nuevo desde `/auth/register`.
