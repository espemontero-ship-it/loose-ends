# Desplegar Loose Ends

El código está listo. Los pasos de abajo solo los puedes hacer tú porque requieren iniciar sesión en tus cuentas.

## 1. Repo privado en GitHub

```bash
git init
git add .
git commit -m "Loose Ends: dossier de Security"
```

Crea un repositorio **privado** en GitHub y súbelo:

```bash
git remote add origin https://github.com/<tu-usuario>/loose-ends.git
git push -u origin main
```

## 2. Conectar a Vercel

En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo. Detecta Next.js automáticamente.

## 3. Añadir Postgres (Neon)

Desde el dashboard del proyecto en Vercel → pestaña **Storage** → **Create Database → Postgres (Neon)**. Esto añade automáticamente `DATABASE_URL` a las variables de entorno.

(No uses Supabase aquí — ya está al límite de 2 proyectos gratuitos con tus otras apps.)

## 4. Crear la tabla

Copia `DATABASE_URL` del dashboard de Vercel a tu `.env.local` para este paso puntual, o usa el editor SQL de Neon directamente:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

(o pega el contenido de `db/schema.sql` en el editor SQL del dashboard de Neon).

## 5. Deploy

Cualquier `git push` a `main` despliega automáticamente. El primer deploy debería quedar listo en cuanto añadas Postgres.

## 6. Probar

1. Entra a la URL de Vercel desde tu móvil.
2. Escribe tu nombre cuando te lo pida (queda guardado en ese móvil).
3. Añade un expediente de prueba con el botón "+".
4. Desde otro móvil (o borrando el nombre guardado y entrando con otro), comprueba que el expediente aparece (puede tardar hasta 15 segundos en refrescarse solo).
