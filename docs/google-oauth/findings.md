# OAuth de Google + Gmail — hallazgos verificados

Registro de lo aprendido al resolver la reconexión semanal de Gmail (12 de
septiembre de 2026). Cada afirmación está clasificada por su origen:

- **[V]** verificado en esta sesión — se indica con qué evidencia.
- **[G]** texto mostrado por Google (consola o pantalla de consentimiento), citado literal.
- **[D]** documentado por Google pero **no** comprobado aquí — contrastar con sus docs antes de depender de ello.
- **[P]** pendiente: no se pudo comprobar y se explica por qué.

---

## 1. El problema original

**[G]** Con la app OAuth en estado de publicación **Prueba**, Google caduca los
refresh tokens a los **7 días**. Efecto observado: había que volver a dar permisos
cada semana para poder sincronizar.

**[V]** No era un defecto del código. El flujo ya pedía `access_type=offline` y
guardaba el `refresh_token` cifrado; el token simplemente dejaba de ser válido.

Dato relevante: `https://www.googleapis.com/auth/gmail.readonly` es un scope
**restringido** para Google, el nivel que exige más requisitos.

---

## 2. Publicar la app a producción

**[V]** Pasar el estado a **En producción** es lo que elimina la caducidad de 7
días. Se hizo desde `https://console.cloud.google.com/auth/audience`
(*Plataforma de autenticación de Google → Público*).

### Lo que la consola pidió para publicar

| Requisito | Valor usado |
|---|---|
| Logo de la pantalla de consentimiento | PNG 120×120 (`assets/consent-logo-120.png`) |
| Dominios autorizados | `voexbnscadfcvholytyd.supabase.co` **y** `bernie-wallet.vercel.app` |
| Página principal | `https://bernie-wallet.vercel.app` |
| Política de Privacidad | `https://bernie-wallet.vercel.app/privacy` |
| Condiciones del Servicio | `https://bernie-wallet.vercel.app/terms` (la consola lo marca opcional) |
| Correo de asistencia (público) | `soporte-bernie-wallet@googlegroups.com` |
| Contacto del desarrollador (privado) | correo personal del autor |

**[G]** Texto de la consola sobre el logo: *"Sube una imagen con un tamaño máximo
de 1 MB … Los formatos de imagen permitidos son JPG, PNG y BMP. Para obtener los
mejores resultados, los logotipos deben ser cuadrados y de 120 píxeles x 120
píxeles."*

**[V]** El dominio de Supabase (`voexbnscadfcvholytyd.supabase.co`) **debe
permanecer** entre los dominios autorizados: el redirect de OAuth apunta a
`https://voexbnscadfcvholytyd.supabase.co/auth/v1/callback`, no a la app.

**[V]** Las URLs de política y condiciones deben responder **200** antes de
completar el formulario: al momento de llenarlo devolvían 404 y hubo que crear y
desplegar las páginas primero (ver `SPEC.md` §14).

### Estado después de publicar

**[G]** Aparece un aviso permanente: *"Tu app requiere una verificación. Cuando
termines de configurar la información, envía tu app para su revisión."*

**[V]** Ese aviso **no impide** publicar: el campo **Estado de publicación** pasó
a **En producción** con el aviso presente. No se envió nada a verificación.

**[G]** Límite de usuarios de OAuth: *"El límite de usuarios condiciona la
cantidad de usuarios que pueden otorgar permiso a tu app cuando se hacen
solicitudes de permisos sensibles o restringidos sin aprobación. Se aplica para
todo el ciclo de vida del proyecto y no se puede restablecer ni cambiar."*
Estado observado tras publicar: **2 usuarios del máximo de 100**.

---

## 3. Correo de asistencia mediante Grupo de Google

**[V]** El campo *Correo electrónico de asistencia al usuario* es un desplegable:
solo acepta el correo de la cuenta de desarrollador o un Grupo de Google del que
esa cuenta sea propietaria. No admite texto libre, así que crear otra cuenta Gmail
no habría servido.

**[V]** Configuración del grupo que funcionó:

| Ajuste | Valor |
|---|---|
| Quién puede publicar | Cualquier usuario de la Web |
| Quién puede ver las conversaciones | Administradores del grupo |
| Quién puede unirse | Solo usuarios invitados |
| Quién puede buscar el grupo | Miembros del grupo |
| Quién puede ver miembros | Propietarios del grupo |
| Funciones adicionales | Sin funciones adicionales |

Miembros: solo el autor, como propietario.

**[V]** Un correo enviado **desde otra cuenta** llegó al grupo y se reenvió a la
bandeja del autor. Requiere *Mi configuración de suscripción → Cada correo
electrónico*.

**[V]** Google Groups **no devuelve copia de las propias publicaciones**: un
correo enviado desde la cuenta propietaria aparece en *Conversaciones* pero no
llega a la bandeja. Por eso una autoprueba no demuestra nada.

**[V]** El grupo cubre el lado entrante. Al **responder** desde Gmail, el
destinatario ve el correo personal del autor: el grupo no reescribe el remitente.

**[V]** El grupo ya aparece como desarrollador en la pantalla de consentimiento:
*"…confías en el desarrollador (soporte-bernie-wallet@googlegroups.com)"*.

---

## 4. `prompt=consent`: por qué estaba y por qué se quitó

**[V]** Google entrega `provider_refresh_token` solo en la **primera**
autorización de una cuenta, o cuando se fuerza el consentimiento con
`prompt=consent`. Por eso el login lo enviaba siempre: con la app en *Prueba* y el
token caducando cada 7 días, era la única forma de reemitirlo. No fue un defecto,
fue una decisión atada a una restricción que dejó de existir al publicar.

**[V]** `prompt=consent` obliga a Google a repintar la pantalla de consentimiento
aunque el permiso ya esté concedido; y en un scope restringido de una app sin
verificar, ese flujo arrastra además el aviso de *"Google no ha verificado esta
aplicación"*. Al quitarlo, Google reconoce el permiso vigente y no muestra
ninguna de las dos.

**[V]** Evidencia directa: la URL de autorización generada tras el cambio, leída
en el navegador, contiene `access_type=offline`, `client_id`, `scope` y
`redirect_uri`, y **no contiene `prompt`**.

### Reparto de responsabilidades

**[V]** La consola y el código gobiernan cosas distintas:

| Controla | Quién | Ejemplo |
|---|---|---|
| Estado de publicación, scopes declarados, branding, dominios, contactos | Consola de Google | Publicar a producción eliminó la caducidad de 7 días |
| Parámetros de cada petición de autorización | Código de la app | Quitar `prompt=consent` eliminó las pantallas |

Por eso el segundo arreglo **no requirió ningún cambio en la consola**.

### Qué se cambió en el código

Commit `c87ea25`:

- El login normal envía solo `access_type=offline`.
- `/login?reconnect=1` envía además `prompt=consent` y cambia el copy a
  "Reconecta tu Gmail"; es el único camino que reemite el `refresh_token`.
- El modal de reconexión de `SyncButton` redirige a `/login?reconnect=1`.
- El callback (`app/api/auth/callback/route.ts`) solo sobrescribe `google_tokens`
  **si llega** un token nuevo. Ese guard ya existía y es lo que hace seguro el
  login silencioso: sin él se habría guardado un valor vacío sobre el token bueno.

---

## 5. Qué cambia y qué no, por escenario

**[V]** Verificado en producción y en local:

| Escenario | Pantallas de Google |
|---|---|
| Login posterior al primero, permiso vigente | ninguna |
| Login tras borrar cookies y `localStorage` de la app | ninguna |
| `/login?reconnect=1` | advertencia + permisos (a propósito) |

**[G]/[V]** Sin cambio respecto de antes:

- **Primer consentimiento de una cuenta**: siempre muestra advertencia + permisos.
  No es evitable: es el momento en que se concede el permiso.
- **Tras revocar el acceso** en `myaccount.google.com/permissions`: Google lo
  trata como un permiso nuevo.
- **Sin sesión de Google en el navegador**: Google pide identificarse (selector de
  cuenta, correo, contraseña). Eso no depende del parámetro `prompt`.

**[V]** El cambio **no** altera: el scope solicitado, el cifrado del token, el
estado "no verificada" de la app, ni el registro manual de gastos.

---

## 6. Evidencia de las pruebas

**[V]** Realizadas el 12 de septiembre de 2026, después del deploy del merge:

| Prueba | Entorno | Resultado |
|---|---|---|
| Logout + cookies borradas + login | Producción, navegador integrado | Dashboard directo, sin pantallas |
| Logout + cookies borradas + login | Producción, Chrome real del autor | Dashboard directo, sin pantallas |
| Logout + `localStorage` borrado + login | Local (`localhost:3000`) | Dashboard directo; log del server: `GET /api/auth/callback?code=… 307` |
| Sincronizar tras login silencioso | Producción | "Estás al día", sin modal de reconexión → el token guardado sobrevivió |
| `/login?reconnect=1` | Local | Redirige a Google con `prompt=consent` |
| Logs de errores del dev server | Local | Sin errores (el `upsert` de `google_tokens` no falló) |

---

## 7. Limitaciones de la automatización de pruebas

**[V]** El navegador aislado del MCP de chrome-devtools (equivalente a incógnito:
sin cookies ni sesión) llega hasta el login de Google y ahí Google lo corta:
*"Couldn't sign you in — This browser or app may not be secure."* Es una defensa
de Google contra navegadores automatizados, ajena a la app.

**[V]** El navegador integrado del editor **sí** fue aceptado por Google para
iniciar sesión.

**[P]** No se comprobó el caso "dispositivo nuevo sin sesión de Google previa"
hasta el final: requiere escribir la contraseña de la cuenta, cosa que el agente no
hace. Queda para prueba manual en una ventana de incógnito.

**[P]** Tampoco se comprobó, y solo lo dirá el calendario: que al **20 de
septiembre de 2026** (día 8 tras la reautorización) la app no pida reconectar
Gmail. Esa es la confirmación final de que la caducidad de 7 días desapareció.

---

## 8. Políticas de Google no comprobadas en esta sesión

**[D]** Contrastar con la documentación oficial antes de depender de ellas:

- Un `refresh_token` con scopes de Gmail se invalida si el usuario cambia la
  contraseña de su cuenta de Google.
- Un `refresh_token` sin usar durante 6 meses caduca.
- Google mantiene un número limitado de refresh tokens por par cliente/usuario;
  al superarlo, los más antiguos se invalidan.
- Eliminar la pantalla de "app no verificada" exige completar la verificación de
  Google, que para scopes restringidos incluye una evaluación de seguridad por un
  tercero (CASA) de renovación anual, dominio propio verificado en Search Console,
  política de privacidad en ese dominio y video de demostración. No se intentó,
  así que no hay datos propios de costo ni de plazos.
- `bernie-wallet.vercel.app` no sería verificable en Search Console, porque el
  dominio `vercel.app` no es propiedad del autor. Verificar exigiría un dominio
  propio.

---

## 9. Alternativas evaluadas y descartadas (por ahora)

**[V]** Analizadas durante esta sesión; ninguna implementada:

- **Dominio personalizado de Supabase**: cambiaría el dominio que muestra Google
  en el consentimiento (hoy `voexbnscadfcvholytyd.supabase.co`). Es un add-on de
  pago de Supabase y exige dominio propio.
- **Mover el OAuth a la propia app** (redirect a `bernie-wallet.vercel.app` y
  sesión con `signInWithIdToken`): sin costo mensual, mostraría el dominio y las
  páginas legales propias, pero implica reescribir login, callback y guardado del
  token.
- **Apps Script** en la cuenta del usuario que empuje los correos a un endpoint:
  evita el OAuth de la app; al autorizar el script aparece una advertencia
  equivalente una vez.
- **Reenvío de correo (inbound)**: un filtro de Gmail reenvía a una dirección de
  ingesta que llama a un webhook. Elimina por completo el scope restringido y, con
  él, la pantalla de app no verificada. Es la opción de raíz si la app se abre a
  otras personas.

---

## 10. Detalle menor detectado

**[V]** La URL de autorización viaja con el scope duplicado:
`scope=email+profile+email+profile+…gmail.readonly`, porque la constante
`GMAIL_SCOPES` incluye `email profile` y Supabase los añade por su cuenta. Google
lo deduplica y no afecta el funcionamiento. Pendiente de limpiar si se vuelve a
tocar `app/(auth)/login/google-sign-in-button.tsx`.
