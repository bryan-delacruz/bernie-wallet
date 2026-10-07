# Restaurar un respaldo

El artefacto que deja el workflow `backup` está cifrado con AES-256-CBC y la
passphrase que vive en los secretos de GitHub. Para leerlo:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in backup.json.enc -out backup.json
```

Pide la passphrase. El resultado es un JSON con una clave por tabla.

**Qué contiene**: usuarios, bancos conectados, medios de pago, categorías,
subcategorías, retos y gastos.

**Qué no**: los tokens de Google —son credenciales, y tras una restauración cada
usuario vuelve a conectar su Gmail— ni las tablas operativas de sync, que se
regeneran solas en la siguiente corrida.

**Para restaurar**, el orden importa por las claves foráneas: `users` →
`user_banks` → `payment_methods` → `categories` → `subcategories` → `challenges` →
`expenses`. Las filas de `auth.users` no están en el respaldo: si se perdieron, el
usuario entra de nuevo con Google y hay que reasignar su `id`.

> Un respaldo que nunca se probó no es un respaldo. Conviene descifrar uno y
> mirarlo al menos una vez.
