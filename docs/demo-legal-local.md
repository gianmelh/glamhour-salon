# Demo local para revisión legal

Esta demo ejecuta la aplicación web real y su API sobre una base PostgreSQL nueva
y temporal. Solo contiene ejemplos ficticios. No es un enlace público ni una
cuenta de producción.

## Abrir

Requisitos: dependencias del proyecto instaladas, Node.js compatible con el
proyecto y PostgreSQL 16 o 17 con `initdb` y `pg_ctl`.

```bash
npm run demo:legal
```

Abre <http://127.0.0.1:4178/demo> en el mismo equipo:

- Cuenta: `abogado@example.test`
- Contraseña de demostración: `DemoLegal2026!`

Puedes cambiar el puerto con `GLAMHOUR_DEMO_PORT=4179` o indicar los binarios
PostgreSQL con `GLAMHOUR_DEMO_POSTGRES_BIN`. La dirección sigue siendo loopback.
Detén con Ctrl+C. El proceso detiene el cluster y elimina sus archivos. Al volver
a iniciarlo tendrás los datos iniciales; los cambios no se conservan.

## Recorrido

1. Iniciar sesión; revisar Inicio, Agenda, Clientes, Servicios, Equipo y Ventas.
2. Abrir Cliente Demo 1 y sus cuatro fichas: uñas, pestañas, cosmetología y
   micropigmentación. Se pueden guardar cambios en esta base temporal.
3. Consultar las citas futuras y el historial de citas completadas.
4. Revisar Settings y suscripción. El estado Premium es un fixture, sin cobros.
5. Revisar el enlace público del salón. `cliente8@example.test` está prevalidado
   solo en esta base para recorrer reservas sin enviar un código. Los demás
   correos necesitan SMTP, que está desactivado. El envío de confirmación también
   queda desactivado; esto se refleja en la respuesta de la aplicación.
6. Revisar `/terms` y `/privacy`; son las pantallas actuales del repositorio.

Hay 8 clientes, 3 profesionales, 4 categorías, servicios, citas, importes de
ejemplo e historial de tratamientos. Los ejemplos de firmas no son firmas reales.
Las referencias antiguas a fotos no incluyen fotografías de personas.

## Aislamiento y límites

- El lanzador crea su propio cluster en un directorio temporal y comprueba su
  identidad antes de aplicar el esquema y los ejemplos. PostgreSQL escucha solo
  en su socket Unix privado, sin puerto TCP.
- El proceso usa una lista explícita de variables de entorno; no hereda
  credenciales ni carga `.env`. El frontend se recompila con `envDir` vacío y
  `/api` local; no reutiliza `dist` ni `uploads` del proyecto.
- La API escucha únicamente en `127.0.0.1`. Comprueba Host y Origin, y bloquea
  conexiones salientes salvo al socket PostgreSQL propio. El navegador recibe
  una CSP que impide cargar scripts, imágenes, iframes y conexiones externas.
- Stripe, SMTP, Google Maps y acceso social no están configurados. No se prueba
  cobro, entrega real de correo, publicación móvil ni seguridad de producción.
- Los enlaces de reserva apuntan a esta demo local. Los botones de WhatsApp,
  SMS y redes vuelven a la guía en esta compilación, sin abrir esas aplicaciones.
- No se debe publicar esta instancia, abrir un túnel ni introducir datos reales.
  La aplicación original todavía requiere completar autenticación/autorización
  del API; una cuenta distinta en una base compartida no aporta aislamiento.

Para una revisión remota, puede compartirse pantalla o ejecutarse el proyecto en
el equipo del revisor. Un enlace remoto requiere preparar un entorno dedicado,
con protección de acceso y almacenes exclusivos, y su revisión manual antes de
publicarlo. No se ha creado ni desplegado dicho entorno.

## Verificación automática local

```bash
npm run demo:legal:check
```

Verifica inicio de sesión, datos ficticios, escritura local, cuatro fichas,
rechazo de un Origin ajeno, CSP y bloqueo de red del backend. Después detiene y
elimina su base temporal. No usa producción ni envía mensajes.
