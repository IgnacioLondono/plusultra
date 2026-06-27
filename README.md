# Plusultra

Panel de control Docker universal con interfaz completa. Gestiona contenedores, imágenes, volúmenes y redes desde una sola aplicación.

## Características

- **Dashboard** — estadísticas en tiempo real del host Docker
- **Contenedores** — iniciar, detener, reiniciar, pausar, eliminar, ver logs y detalles
- **Lanzar** — crear contenedores con plantillas (Nginx, PostgreSQL, Nextcloud, etc.)
- **Imágenes** — listar, descargar y eliminar
- **Volúmenes** — crear y gestionar
- **Redes** — crear y gestionar
- **Logs en vivo** — streaming de logs por WebSocket, filtro, descarga
- **Terminal** — shell interactiva dentro de cualquier contenedor (Nextcloud, DB, etc.)

## Requisitos

- Node.js 18+
- Docker Desktop (Windows/Mac) o Docker Engine (Linux)

## Instalación local

```bash
npm run install:all
npm run dev
```

Abre **http://localhost:5173**

## Producción

```bash
npm run install:all
npm run build
npm start
```

Abre **http://localhost:3001**

## Con Docker

```bash
docker compose up -d --build
```

Abre **http://localhost:3040**

## Configuración Docker

| Sistema | Socket por defecto |
|---------|-------------------|
| Windows | `//./pipe/docker_engine` |
| Linux/Mac | `/var/run/docker.sock` |
| Remoto | `tcp://IP:2375` |

Cambia la conexión en **Configuración → Conexión Docker**.

## Nota de seguridad

Plusultra tiene acceso completo al socket de Docker. No expongas el puerto a Internet sin autenticación. Úsalo en red local o detrás de un proxy con auth.
