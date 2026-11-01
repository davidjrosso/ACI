# Despliegue en un VPS (ej. Contabo, Ubuntu)

## 1. Compilar y levantar

```bash
git clone <repo> /opt/territorio && cd /opt/territorio
npm ci
npm run build
```

Variables de entorno (archivo `/etc/territorio.env`):

```bash
PORT=3000
HOST=127.0.0.1
DATA_DIR=/var/lib/territorio
COOKIE_SECURE=1                 # obligatorio detrás de HTTPS
PLATFORM_TOKEN=<cadena larga aleatoria>   # para dar de alta campañas
SESSION_DAYS=30
```

Servicio systemd (`/etc/systemd/system/territorio.service`):

```ini
[Unit]
Description=Territorio
After=network.target

[Service]
EnvironmentFile=/etc/territorio.env
WorkingDirectory=/opt/territorio
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
User=territorio

[Install]
WantedBy=multi-user.target
```

## 2. nginx + HTTPS

```nginx
server {
  server_name campania.ejemplo.com.ar;
  client_max_body_size 6m;
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

## 4. Backups

Cada campaña es un archivo. Backup en caliente y consistente con SQLite:

```bash
for f in /var/lib/territorio/campanias/*.db /var/lib/territorio/plataforma.db; do
  sqlite3 "$f" ".backup '/var/backups/territorio/$(basename "$f" .db)-$(date +%F).db'"
done
```

Programarlo en cron diario y copiar fuera del servidor. Probar la restauración antes de cada actualización.

## 5. Actualizar

1. Backup verificado (ver arriba).
2. `git pull && npm ci && npm run build`.
3. `systemctl restart territorio`. Las migraciones nuevas se aplican solas al abrir cada campaña.
4. Verificar `GET /api/salud`.
