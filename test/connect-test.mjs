// Test end-to-end de task-board.
import path from 'node:path';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const packageDir = path.resolve(import.meta.dirname, '..');
const tmpDir = path.join(packageDir, 'test', 'tmp');
rmSync(tmpDir, { recursive: true, force: true });
const home = path.join(tmpDir, 'dsh-home');
mkdirSync(home, { recursive: true });

function makeClient(extraEnv = {}) {
  const entry = process.env.BOARD_SERVER ? path.resolve(process.env.BOARD_SERVER) : path.join(packageDir, 'server.mjs');
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { SystemRoot: process.env.SystemRoot || 'C:\\Windows', PATH: process.env.PATH, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME || process.env.USERPROFILE, TEMP: process.env.TEMP, TMP: process.env.TMP, DSH_HOME: home, ...extraEnv }, stderr: 'pipe' });
  transport.stderr?.on('data', (c) => process.stderr.write(`[server] ${c}`));
  const client = new Client({ name: 'board-test', version: '1.0.0' }, { capabilities: {}, versionNegotiation: { mode: 'auto' } });
  return client.connect(transport).then(() => ({ client, transport }));
}
const textOf = (r) => (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');

const { client, transport } = await makeClient();
console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '));
console.log('--- status ---'); console.log(textOf(await client.callTool({ name: 'status', arguments: {} })));
const noConfirm = await client.callTool({ name: 'add', arguments: { title: 'x' } });
console.log('add sin confirm isError:', noConfirm.isError === true);
await client.callTool({ name: 'add', arguments: { title: 'Preparar release', priority: 'high', project: 'dsh', tags: ['release'], confirm: true } });
await client.callTool({ name: 'add', arguments: { title: 'Escribir docs', column: 'in_progress', confirm: true } });
const dup = await client.callTool({ name: 'add', arguments: { title: 'preparar release', confirm: true } });
console.log('duplicado isError:', dup.isError === true);
const board = textOf(await client.callTool({ name: 'board', arguments: {} }));
console.log('--- board ---'); console.log(board);
console.log('muestra columnas:', board.includes('## todo') && board.includes('## in_progress'));
const status = textOf(await client.callTool({ name: 'status', arguments: {} }));
console.log('status cuenta:', status.includes('in_progress: 1') && status.includes('todo: 1'));
const moved = textOf(await client.callTool({ name: 'move', arguments: { ref: 'Preparar release', column: 'done', confirm: true } }));
console.log('--- move ---'); console.log(moved);
console.log('mueve:', moved.includes('todo → done'));
const filtered = textOf(await client.callTool({ name: 'board', arguments: { project: 'dsh' } }));
console.log('filtra proyecto:', filtered.includes('Preparar release') && !filtered.includes('Escribir docs'));
const removed = textOf(await client.callTool({ name: 'remove', arguments: { ref: 'Escribir docs', confirm: true } }));
console.log('remove:', removed.includes('eliminada'));
const store = JSON.parse(readFileSync(path.join(home, 'task-board', 'board.json'), 'utf8'));
console.log('persiste:', store.columns.done.length === 1 && store.columns.todo.length === 0);
const missing = await client.callTool({ name: 'move', arguments: { ref: 'no-existe', column: 'done', confirm: true } });
console.log('inexistente isError:', missing.isError === true);
await client.close(); try { await transport.close?.(); } catch {}
const { client: roClient, transport: roTransport } = await makeClient({ DSH_BOARD_MODE: 'read-only' });
const roAdd = await roClient.callTool({ name: 'add', arguments: { title: 'no', confirm: true } });
console.log('read-only add isError:', roAdd.isError === true);
await roClient.close(); try { await roTransport.close?.(); } catch {}
console.log('OK');
