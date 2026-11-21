# Gravity Shift 2.0 — Neon Circuit

Versión candidata final para pruebas. Juego de carreras con inversión de gravedad, 12 personajes exclusivos y multijugador híbrido (hasta dos usuarios por PC, entre 1 y 12 plazas por sala). **No sustituye ni publica automáticamente la versión que está en Render.**

## Modos
- Abrí `gravity_shift_2_0_final_demo.html` para probar el modo local sin instalar nada. Funciona en navegadores modernos sin conexión; la opción online necesita servidor.
- Para jugar online: `npm install && npm start` en la carpeta de este proyecto, y visitá `http://localhost:3000`. Para Internet, publicá el repositorio en Render como servicio Node con build `npm install`, start `npm start`, `PORT` asignado por Render y WebSockets habilitados.
- El servidor gestiona salas de 1 a 12 jugadores, reservaciones únicas y asignación aleatoria al empezar.
- Para añadir dos personas desde una PC: seleccioná `2 jugadores` antes de crear/unirte a la sala; usan **Espacio** y **L**. En móvil, tocá las mitades izquierda y derecha de la pista.

## Reglas importantes
- Los bloques y otros corredores obstruyen, no matan al contacto.
- Las sierras matan inmediatamente.
- La cámara se desplaza de forma independiente incluso cuando el corredor se bloquea.
- El corredor pierde si **toda su hitbox** sale por el borde **izquierdo**, **superior** o **inferior** de la vista. No hay línea roja de eliminación.
- H muestra las hitboxes. Los 12 personajes tienen la misma física.

## Limitaciones que se deben verificar antes de reemplazar la versión pública
- El comportamiento de superficies curvas en U todavía no es equivalente al del video de G-Switch. Esta versión usa plataformas rectas, huecos y obstáculos.
- La sincronización online es autoritativa y prioriza consistencia sobre predicción de latencia; probar con conexiones reales desde iPhone y PC.
- Las salas están en memoria: se pierden si Render reinicia la instancia. Ejecutar una instancia del servicio.
- Los sprites son imágenes de poses de carrera con animación por transformación; todavía no son animaciones cuadro a cuadro.
- Personajes y escenarios son diseños independientes y no recursos extraídos de G-Switch.

## Estructura
- `server.js`: servicio HTTP y WebSocket.
- `public/engine.js`: motor y colisiones compartidos por cliente y servidor.
- `public/client.js`: menús, selección, controles y renderizado.
- `public/style.css`: interfaz neón responsiva.
- `public/assets`: 12 retratos y 12 sprites originales.
- `tests`: tests del motor y del servidor.
