# Configuración OAuth de Google (pantalla de consentimiento)

Registro de lo que Google Cloud pide para la app OAuth de Bernie Wallet, para no
tener que redescubrirlo cada vez que cambia la consola.

Los hallazgos técnicos completos (comportamiento de `prompt=consent`, evidencia de
las pruebas, políticas de Google y limitaciones) están en
[`findings.md`](findings.md). Este archivo se queda con el trámite.

## Por qué existe este documento

El scope que usamos, `https://www.googleapis.com/auth/gmail.readonly`, es un scope
**restringido** (el nivel más alto de Google). Mientras el proyecto está en estado
de publicación **Prueba / Testing**, Google **caduca los refresh tokens a los 7 días**,
así que el usuario debe volver a dar permisos cada semana. Es comportamiento de la
plataforma, no un bug de la app: nuestro flujo ya pide `access_type=offline` +
`prompt=consent` y guarda el refresh token cifrado.

Pasar el estado a **En producción** quita esa caducidad de 7 días.

## Datos de la app

- Proyecto: Google Cloud (mismo `GOOGLE_CLIENT_ID` en local y en Vercel → publicar
  una vez resuelve ambos ambientes).
- Scope solicitado: `gmail.readonly` (restringido).
- Redirect URIs: `https://<dominio-vercel>/api/auth/callback` y
  `http://localhost:3000/api/auth/callback`.
- Estado de publicación: **Prueba** (pendiente de pasar a *En producción*).
- Correo de asistencia / contacto público: `soporte-bernie-wallet@googlegroups.com`
  (Grupo de Google del que el autor es propietario — la consola solo acepta el correo
  del desarrollador o un grupo propio. Config: cualquiera en la Web puede publicar,
  solo administradores ven las conversaciones). Es el mismo valor que la constante
  `CONTACT_EMAIL` de `app/privacy/page.tsx` y `app/terms/page.tsx`.

## Dominio de la app (sección "Dominio de la app" de la consola)

| Campo | Valor | ¿Obligatorio? |
|---|---|---|
| Dominios autorizados | `bernie-wallet.vercel.app` | Sí |
| Página principal | `https://bernie-wallet.vercel.app` | Sí |
| Política de Privacidad | `https://bernie-wallet.vercel.app/privacy` | Sí |
| Condiciones del Servicio | `https://bernie-wallet.vercel.app/terms` | Opcional |

Las tres URLs deben ser **públicas** (sin login) y vivir en el dominio autorizado;
Google rechaza un 404 o una página detrás de autenticación. Las páginas legales son
estáticas y se sirven desde la propia app — ver §14 de `SPEC.md`.

## Assets que pide la consola

| Requisito de Google | Archivo | Detalle |
|---|---|---|
| Logo de la pantalla de consentimiento | [`assets/consent-logo-120.png`](assets/consent-logo-120.png) | PNG 120×120, ~10 KB. Máx. 1 MB; formatos JPG/PNG/BMP; cuadrado 120×120 recomendado. |
| Variante cuadrada (sin esquinas redondeadas) | [`assets/consent-logo-120-square.png`](assets/consent-logo-120-square.png) | Alternativa si la consola recorta el logo en círculo. |

Los dos se generan desde el ícono de marca que ya vive en el código
(`lib/pwa-icon.tsx`, vía las rutas `next/og` `/icon-512` y `/apple-icon`), así que
el logo del consentimiento no se desalinea del favicon ni de la PWA.

Para regenerarlos con el dev server corriendo:

```bash
curl -s -o /tmp/icon-512.png http://localhost:3000/icon-512
sips -z 120 120 /tmp/icon-512.png --out docs/google-oauth/assets/consent-logo-120.png
```

## Estado del trámite

- [x] Logo 120×120 generado.
- [x] Páginas `/privacy` y `/terms` creadas (estáticas, públicas).
- [x] Páginas desplegadas a producción — responden 200 (PR #8).
- [x] Logo subido a la pantalla de consentimiento.
- [x] Sección "Dominio de la app" completada con la tabla de arriba.
- [x] Correo de asistencia apuntado al Grupo de Google.
- [x] Estado de publicación cambiado a **En producción** (12-09-2026).
- [x] Reautorizado en producción: el consentimiento nuevo emitió un refresh token
      sin la caducidad de 7 días.
- [x] Login sin `prompt=consent` (PR #9) — probado en producción y en local.
- [ ] **20-09-2026**: confirmar que al día 8 no pide reconectar Gmail. Es la única
      comprobación que falta y solo la da el tiempo.

Si la consola exige **enviar a verificación** (dominio autorizado, política de
privacidad, video de demostración, justificación del scope → evaluación CASA), no
enviarlo: para un solo usuario las alternativas son un **Apps Script** en la propia
cuenta que empuje los correos a un endpoint, o **reenvío de correo (inbound)**, que
saca a la app de la Gmail API por completo.

## Límites que ninguna de las opciones evita

- Cambiar la contraseña de la cuenta Google invalida los refresh tokens con scopes
  de Gmail.
- Un refresh token sin usar durante 6 meses caduca.
- Google guarda máximo 5 refresh tokens por cliente/usuario; los viejos se invalidan.
