#!/usr/bin/env node
// dsh-plugin-task-board — tablero kanban local.
// Tools: status, board, add, move, remove.

import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

const VERSION = '0.1.0';
const DSH_HOME = (() => {
  const v = process.env.DSH_HOME && process.env.DSH_HOME.trim();
  return v || path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), '.dsh');
})();
const STORE_FILE = path.join(DSH_HOME, 'task-board', 'board.json');
const CACHE_DIR = path.join(DSH_HOME, 'cache', 'task-board');
const READ_ONLY = String(process.env.DSH_BOARD_MODE || '').toLowerCase() === 'read-only';
const COLUMNS = ['todo', 'in_progress', 'blocked', 'done'];
const log = (m) => process.stderr.write(`[board] ${m}\n`);

function load() {
  try {
    if (existsSync(STORE_FILE)) {
      const data = JSON.parse(readFileSync(STORE_FILE, 'utf8')) || {};
      const columns = {};
      for (const column of COLUMNS) columns[column] = Array.isArray(data.columns?.[column]) ? data.columns[column] : [];
      return { columns };
    }
  } catch { /* reset */ }
  return { columns: Object.fromEntries(COLUMNS.map((column) => [column, []])) };
}
function save(data) { mkdirSync(path.dirname(STORE_FILE), { recursive: true }); writeFileSync(STORE_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8'); }
function allCards(data) { return COLUMNS.flatMap((column) => data.columns[column].map((card) => ({ ...card, column }))); }
function findCard(data, ref) {
  const wanted = String(ref || '').trim().toLowerCase();
  return allCards(data).find((card) => card.id === wanted) || allCards(data).find((card) => card.title.toLowerCase() === wanted) || allCards(data).find((card) => card.title.toLowerCase().includes(wanted));
}
function textResult(text) { return { content: [{ type: 'text', text }] }; }
function fmt(card) { return `[${card.priority}] ${card.title}${card.project ? ` · ${card.project}` : ''}${card.tags?.length ? ` #${card.tags.join(' #')}` : ''} · id ${card.id}`; }

function buildInstructions() {
  return [
    'Task Board: tablero kanban local del harness.',
    '',
    `Store: ${STORE_FILE}`,
    '',
    'Herramientas: status, board, add, move, remove.',
    '',
    'Reglas:',
    '- add/move/remove requieren confirm:true y pedido explícito.',
    '- Columnas: todo, in_progress, blocked, done.',
    '- Reporta el estado real del tablero; no inventes tarjetas.',
  ].join('\n');
}

function buildServer() {
  const server = new McpServer({ name: 'dsh-plugin-task-board', version: VERSION }, { capabilities: { tools: {} }, instructions: buildInstructions() });

  server.registerTool(
    'status',
    { title: 'Estado', description: 'Cantidad de tarjetas por columna.', inputSchema: z.object({}) },
    async () => {
      const data = load();
      return textResult([...COLUMNS.map((column) => `${column}: ${data.columns[column].length}`), `Total: ${allCards(data).length}`, `Store: ${STORE_FILE}`, `Modo: ${READ_ONLY ? 'read-only' : 'normal'}`].join('\n'));
    },
  );

  server.registerTool(
    'board',
    { title: 'Ver tablero', description: 'Lista tarjetas por columna, filtrable por proyecto.', inputSchema: z.object({ project: z.string().optional(), limit: z.number().int().min(1).max(300).optional() }) },
    async (args) => {
      const data = load();
      const lines = [];
      let total = 0;
      for (const column of COLUMNS) {
        let cards = data.columns[column];
        if (args.project) cards = cards.filter((card) => String(card.project || '').toLowerCase().includes(args.project.toLowerCase()));
        if (cards.length === 0) continue;
        lines.push(`## ${column} (${cards.length})`);
        for (const card of cards.slice(0, args.limit ?? 100)) lines.push(fmt(card));
        total += cards.length;
      }
      return textResult(total === 0 ? 'Tablero vacío. Usa add con confirm:true.' : lines.join('\n'));
    },
  );

  server.registerTool(
    'add',
    { title: 'Agregar tarjeta', description: 'Crea una tarjeta. Requiere confirm:true.', inputSchema: z.object({ title: z.string().min(2).max(200), column: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(), priority: z.enum(['low', 'normal', 'high']).optional(), project: z.string().max(120).optional(), notes: z.string().max(1000).optional(), tags: z.array(z.string()).max(10).optional(), confirm: z.boolean().optional() }) },
    async (args) => {
      if (READ_ONLY) throw new Error('modo read-only: add deshabilitado');
      if (args.confirm !== true) throw new Error('add requiere confirm:true y confirmación explícita');
      const data = load();
      if (allCards(data).some((card) => card.title.toLowerCase() === args.title.toLowerCase())) throw new Error(`ya existe una tarjeta con título ${args.title}`);
      const column = args.column || 'todo';
      const card = { id: randomUUID().slice(0, 8), title: args.title, priority: args.priority || 'normal', project: args.project || '', notes: args.notes || '', tags: (args.tags || []).map(String), createdAt: new Date().toISOString(), movedAt: null };
      data.columns[column].push(card);
      save(data);
      return textResult(`Tarjeta creada en ${column}: ${card.title} · id ${card.id}`);
    },
  );

  server.registerTool(
    'move',
    { title: 'Mover tarjeta', description: 'Mueve una tarjeta a otra columna. Requiere confirm:true.', inputSchema: z.object({ ref: z.string().min(1), column: z.enum(['todo', 'in_progress', 'blocked', 'done']), confirm: z.boolean().optional() }) },
    async (args) => {
      if (READ_ONLY) throw new Error('modo read-only: move deshabilitado');
      if (args.confirm !== true) throw new Error('move requiere confirm:true');
      const data = load();
      const card = findCard(data, args.ref);
      if (!card) throw new Error(`tarjeta no encontrada: ${args.ref}`);
      if (card.column === args.column) return textResult(`La tarjeta ya está en ${args.column}: ${card.title}`);
      data.columns[card.column] = data.columns[card.column].filter((item) => item.id !== card.id);
      card.movedAt = new Date().toISOString();
      data.columns[args.column].push(card);
      save(data);
      return textResult(`Movida: ${card.title} · ${card.column} → ${args.column}`);
    },
  );

  server.registerTool(
    'remove',
    { title: 'Eliminar tarjeta', description: 'Elimina una tarjeta. Requiere confirm:true.', inputSchema: z.object({ ref: z.string().min(1), confirm: z.boolean().optional() }) },
    async (args) => {
      if (READ_ONLY) throw new Error('modo read-only: remove deshabilitado');
      if (args.confirm !== true) throw new Error('remove requiere confirm:true');
      const data = load();
      const card = findCard(data, args.ref);
      if (!card) throw new Error(`tarjeta no encontrada: ${args.ref}`);
      data.columns[card.column] = data.columns[card.column].filter((item) => item.id !== card.id);
      save(data);
      return textResult(`Tarjeta eliminada: ${card.title}`);
    },
  );

  return server;
}

try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignora */ }
log(`store: ${STORE_FILE} · modo: ${READ_ONLY ? 'read-only' : 'normal'}`);
serveStdio(buildServer, { onerror: (e) => log(`serveStdio: ${e.message}`) });
process.on('uncaughtException', (e) => log(`excepción: ${e.message}`));
process.on('unhandledRejection', (e) => log(`rechazo: ${e && e.message ? e.message : String(e)}`));
