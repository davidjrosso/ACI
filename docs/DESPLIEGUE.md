# Despliegue en un VPS (ej. Contabo, Ubuntu)

## 1. Compilar y levantar

```bash
git clone https://github.com/davidjrosso/ACI.git /opt/aci && cd /opt/aci
npm ci
npm run build
```

Variables de entorno (archivo `/etc/aci.env`):

```bash
PORT=3000
HOST=127.0.0.1
DATA_DIR=/var/lib/aci
COOKIE_SECURE=1                 # obligatorio detrás de HTTPS
PLATFORM_TOKEN=<cadena larga aleatoria>   # para dar de alta campañas
SESSION_DAYS=30
PUBLIC_URL=https://campania.ejemplo.com.ar   # dirección pública de la plataforma (links de Open Graph)
```

Servicio systemd (`/etc/systemd/system/aci.service`):

```ini
[Unit]
Description=ACI
After=network.target

[Service]
EnvironmentFile=/etc/aci.env
WorkingDirectory=/opt/aci
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
User=aci

[Install]
WantedBy=multi-user.target
```

## 2. nginx + HTTPS

```nginx
server {
  server_name campania.ejemplo.com.ar;
  client_max_body_size 10m;   # subida de imágenes
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Certificado con `certbot --nginx`. **HTTPS es obligatorio**: sin HTTPS la PWA no se instala ni funciona offline, y la geolocalización no está disponible.

## 3. Alta de una campaña nueva

```bash
curl -X POST https://campania.ejemplo.com.ar/api/plataforma/campanias \
  -H "content-type: application/json" -H "x-platform-token: $PLATFORM_TOKEN" \
  -d '{"slug":"perez2027","config":{"nombre":"Frente X","candidato":"Ana Pérez","ciudad":"Mi Ciudad","colorPrimario":"#0f766e","colorSecundario":"#f59e0b"},
       "admin":{"nombre":"Ana Pérez","email":"ana@ejemplo.com","password":"cambiar-esto-123"}}'
```

El candidato entra con el código `perez2027` y lo recibe el asistente de configuración.

## 4. Dominio propio para el sitio de un candidato

1. El candidato apunta su dominio (registro A) a la IP del VPS.
2. Se agrega el dominio a nginx (mismo bloque `proxy_pass`) y se emite el certificado con certbot.
3. Se asocia el dominio a la campaña:

```bash
sqlite3 /var/lib/aci/plataforma.db "INSERT INTO dominios (host, campania) VALUES ('lauramedina.com.ar', 'demo');"
```

Desde ese momento `https://lauramedina.com.ar/` sirve el sitio (con y sin `www`) y los links del panel apuntan ahí. Si se usa `PUBLIC_URL`, conviene dejarla con el dominio de la plataforma: el sitio con dominio propio arma sus links a partir del host de cada visita.

## 5. Backups

Cada campaña es un archivo. Backup en caliente y consistente con SQLite:

```bash
for f in /var/lib/aci/campanias/*.db /var/lib/aci/plataforma.db; do
  sqlite3 "$f" ".backup '/var/backups/aci/$(basename "$f" .db)-$(date +%F).db'"
done
```

Las imágenes están en `/var/lib/aci/media/`: copiarlas también (`rsync`).

Programarlo en cron diario y copiar fuera del servidor. Probar la restauración antes de cada actualización.

## 6. Actualizar

1. Backup verificado (ver arriba).
2. `git pull && npm ci && npm run build`.
3. `systemctl restart aci`. Las migraciones nuevas se aplican solas al abrir cada campaña.
4. Verificar `GET /api/salud`.
