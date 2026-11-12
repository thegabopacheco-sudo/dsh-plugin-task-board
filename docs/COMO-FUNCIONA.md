# Cómo funciona dsh-plugin-task-board

Tablero kanban local para DeepSeek Harness: tarjetas con columnas, prioridad, proyecto y notas, con movimiento, historial y estado por columna.

## Arquitectura

```
DSH ──MCP stdio──► server.mjs (bundle single-file)
                    └─ lógica local del plugin
```

## Herramientas reales

- `status`: Estado
- `board`: Ver tablero
- `add`: Agregar tarjeta
- `move`: Mover tarjeta
- `remove`: Eliminar tarjeta

## Seguridad

- Lectura por defecto; acciones con `confirm:true`.
- Modo `read-only` por variable de entorno.
- Listas blancas cuando aplique.
- Auditoría en `<DSH_HOME>\cache\task-board\audit.jsonl`.
- Rate limit de acciones.

## Verificación

Tests end-to-end con el cliente MCP oficial (`@modelcontextprotocol/client@2.2.0`)
y artefacto empaquetado (`npm pack` → `postinstall` → servidor desplegado).
