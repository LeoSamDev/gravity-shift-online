# Gravity Shift Online

Juego de carreras con inversión de gravedad y servidor WebSocket. Para 1 a 4 jugadores remotos, compatible con Safari iPhone y navegadores de escritorio. Incluye apodos, salas con códigos privados, personajes de colores y colisiones autoritativas para paredes por arriba, abajo y costados.

## Ejecutar localmente

Requiere Node.js 18+.

```bash
npm install
npm start
```

Abrir http://localhost:3000. Comprobar http://localhost:3000/healthz.

## Desplegar en Render

- New > Web Service > Connect repository
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Puerto: variable `PORT` automática de Render (no fijar manualmente)
- Plan: Free, si está disponible

No necesita base de datos para esta versión. Las salas se guardan en memoria y se pierden cuando se reinicia o suspende el servicio. Ejecutar una única instancia. Los clientes deben usar una URL HTTPS publicada con WebSockets (WSS), no un archivo HTML descargado.

## Limitaciones de esta versión

Prototipo inicial sin cuentas persistentes, reconexión, matchmaking público ni medidas exhaustivas contra abuso. La física se calcula en el servidor. No es un servicio optimizado para producción a gran escala.
