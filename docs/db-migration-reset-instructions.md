# Guía de Despliegue en Docker (Servidor Existente)

Esta guía detalla los pasos para aplicar el reinicio del historial de migraciones en un servidor existente usando **Docker Compose**, evitando que el contenedor falle al intentar aplicar la migración inicial sobre tablas que ya existen.

---

## Procedimiento de Despliegue Paso a Paso

Sigue estos comandos en la terminal de tu servidor:

### Paso 1: Realizar una Copia de Seguridad (Backup)

Por seguridad, realiza un respaldo de tu base de datos actual antes de continuar:

```bash
docker exec -t vantx_db pg_dump -U postgres -d vantx_db > backup_antes_de_reset.sql
```

### Paso 2: Detener los contenedores actuales y actualizar el código

Detén la ejecución de la aplicación y haz `git pull` (o actualiza la imagen de la aplicación) para obtener el nuevo código con la carpeta de migración consolidada (`20260605000000_initial`):

```bash
docker compose down
```

### Paso 3: Iniciar únicamente la Base de Datos

Necesitamos que la base de datos esté encendida para poder limpiar el historial de migraciones:

```bash
docker compose up -d vantx_db
```

### Paso 4: Eliminar el Historial de Migraciones Viejo

Borra la tabla interna de control de Prisma (`_prisma_migrations`) para eliminar las 16 referencias antiguas. Esto **no** afectará ninguna de tus tablas con datos de clientes:

```bash
docker compose exec -T vantx_db psql -U postgres -d vantx_db -c "DROP TABLE IF EXISTS _prisma_migrations;"
```

### Paso 5: Registrar la Nueva Migración como Aplicada (Baselining)

Como el contenedor del servidor ejecuta `npx prisma migrate deploy` al arrancar, fallaría si intenta crear tablas existentes. Para evitar esto, corremos un contenedor temporal que marca la migración consolidada como aplicada usando `docker compose run`.

**Nota:** Dado que el entorno de producción no cuenta con compiladores de TypeScript para procesar `prisma.config.ts`, debemos indicar explícitamente la ruta del esquema usando `--schema=./prisma/schema`:

```bash
docker compose run --entrypoint "npx prisma migrate resolve --applied 20260605000000_initial --schema=./prisma/schema" vantx_server
```

_(Esto creará la tabla `_prisma_migrations` nuevamente e insertará la fila de la migración inicial, indicándole a Prisma que no debe re-ejecutar el DDL de creación de tablas)_.

### Paso 6: Iniciar toda la aplicación normalmente

Ahora que el historial está sincronizado, inicia el resto de los servicios. Al arrancar, `npx prisma migrate deploy` detectará que la migración inicial ya está aplicada y el servidor iniciará sin problemas:

```bash
docker compose up -d
```

### Paso 7: Verificar el Estado

Valida que todo esté correcto ejecutando el comando de estado desde un contenedor temporal:

```bash
docker compose run --entrypoint "npx prisma migrate status --schema=./prisma/schema" vantx_server
```

El resultado debe ser: `Database schema is up to date!`.
