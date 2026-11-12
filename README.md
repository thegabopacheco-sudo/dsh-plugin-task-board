# dsh-plugin-task-board — Task Board

Tablero kanban local para DeepSeek Harness: tarjetas con columnas, prioridad, proyecto y notas, con movimiento, historial y estado por columna.

## Herramientas

| Tool | Qué hace |
|---|---|
| `status` | Estado |
| `board` | Ver tablero |
| `add` | Agregar tarjeta |
| `move` | Mover tarjeta |
| `remove` | Eliminar tarjeta |

## Instalación

Desde **DSH → Settings → Plugins** instala `github:thegabopacheco-sudo/dsh-plugin-task-board` y permite el script de instalación.

```
dsh plugin --profile <perfil> add github:thegabopacheco-sudo/dsh-plugin-task-board
```

## Seguridad

- Lectura por defecto; escritura solo con `confirm:true` y pedido explícito.
- `DSH_TASK_BOARD_MODE=read-only` desactiva acciones.
- Listas blancas y auditoría en `<DSH_HOME>\cache\task-board\audit.jsonl`.

## Licencia

MIT © thegabopacheco-sudo
