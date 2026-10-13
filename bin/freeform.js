#!/usr/bin/env node

/**
 * freeform-cli: Headless capture & productivity CLI for Free Form
 *
 * Usage:
 *   export FREEFORM_URL="http://localhost:3000"
 *   export FREEFORM_TOKEN="ff_pat_..."
 *
 *   freeform new "Note content or title" [--title "Title"] [--notebook "Work"] [--tag "cli"]
 *   freeform count "Counter Title" [+5|-1|10]
 *   freeform timer 25m "Pomodoro Sprint"
 *   freeform list
 */

import fs from 'fs';

const rawArgs = process.argv.slice(2);
let customUrl = '';
let customToken = '';
const remainingArgs = [];

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--url' && rawArgs[i + 1]) {
    customUrl = rawArgs[++i];
  } else if (rawArgs[i] === '--token' && rawArgs[i + 1]) {
    customToken = rawArgs[++i];
  } else {
    remainingArgs.push(rawArgs[i]);
  }
}

const SERVER_URL = (customUrl || process.env.FREEFORM_URL || 'http://localhost:3000').replace(/\/+$/, '');
const TOKEN = customToken || process.env.FREEFORM_TOKEN || '';

function printHelp() {
  console.log(`
Free Form CLI (freeform) - Headless Capture & Automation

USAGE:
  freeform new <content> [options]        Capture a new note
  freeform import [options]               Import note from stdin or file
  freeform count <name> [delta|value]      Increment, decrement, or set a counter
  freeform timer <duration> [title]       Create and start a countdown timer
  freeform list                           List recent notes and items

OPTIONS:
  --title <title>       Custom title for the note (default: derived from content)
  --notebook <id|name>  Assign note to notebook
  --tag <name>          Assign tag(s) to note
  --url <url>           Override Free Form server URL
  --token <token>       Override Personal Access Token (PAT)

ENVIRONMENT VARIABLES:
  FREEFORM_URL          Server base URL (e.g. http://192.168.1.50:3000)
  FREEFORM_TOKEN        Personal Access Token (ff_pat_...)
`);
}

async function request(path, options = {}) {
  const url = `${SERVER_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorText}`);
  }
  return res.json();
}

async function handleNew(cmdArgs) {
  let content = '';
  let title = '';
  let notebook = '';
  let tags = [];

  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i];
    if (arg === '--title' && cmdArgs[i + 1]) {
      title = cmdArgs[++i];
    } else if (arg === '--notebook' && cmdArgs[i + 1]) {
      notebook = cmdArgs[++i];
    } else if (arg === '--tag' && cmdArgs[i + 1]) {
      tags.push(cmdArgs[++i]);
    } else if (!arg.startsWith('--')) {
      content = content ? `${content} ${arg}` : arg;
    }
  }

  // If stdin has piped content
  if (!process.stdin.isTTY && !content) {
    content = fs.readFileSync(0, 'utf-8').trim();
  }

  if (!content && !title) {
    console.error('Error: Please provide note content or --title.');
    process.exit(1);
  }

  if (!title) {
    const lines = content.split('\n');
    title = lines[0].replace(/^[#\s]+/, '').slice(0, 50) || 'Quick Note';
  }

  let notebookId = null;
  if (notebook) {
    try {
      const notebooks = await request('/api/notebooks');
      const found = notebooks.find(
        (nb) => nb.id === notebook || nb.name.toLowerCase() === notebook.toLowerCase()
      );
      if (found) notebookId = found.id;
    } catch {}
  }

  const payload = {
    title,
    content,
    type: 'note',
    notebook_id: notebookId,
    tags
  };

  const created = await request('/api/items', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  console.log(`✓ Note created: "${created.title}" [${created.id}]`);
}

async function handleCount(cmdArgs) {
  const targetName = cmdArgs[0];
  const deltaArg = cmdArgs[1] || '+1';

  if (!targetName) {
    console.error('Error: Counter name required. Example: freeform count "Pushups" +5');
    process.exit(1);
  }

  const items = await request('/api/items?type=counter');
  const counter = items.find(
    (i) => i.type === 'counter' && i.title.toLowerCase() === targetName.toLowerCase()
  );

  if (!counter) {
    console.error(`Error: Counter "${targetName}" not found.`);
    process.exit(1);
  }

  let delta = 1;
  let setValue = undefined;
  if (deltaArg.startsWith('+')) {
    delta = parseInt(deltaArg.slice(1), 10) || 1;
  } else if (deltaArg.startsWith('-')) {
    delta = -parseInt(deltaArg.slice(1), 10) || -1;
  } else {
    setValue = parseInt(deltaArg, 10);
  }

  const res = await request(`/api/items/${counter.id}/counter`, {
    method: 'POST',
    body: JSON.stringify(setValue !== undefined ? { setValue } : { delta })
  });

  console.log(`✓ Counter "${counter.title}": ${res.count} (${res.delta >= 0 ? '+' : ''}${res.delta})`);
}

async function handleTimer(cmdArgs) {
  const durationArg = cmdArgs[0];
  const title = cmdArgs.slice(1).join(' ') || 'CLI Timer';

  if (!durationArg) {
    console.error('Error: Duration required. Example: freeform timer 25m "Pomodoro"');
    process.exit(1);
  }

  let seconds = 0;
  const match = durationArg.match(/^(\d+)(s|m|h)?$/i);
  if (!match) {
    seconds = parseInt(durationArg, 10) || 60;
  } else {
    const val = parseInt(match[1], 10);
    const unit = (match[2] || 'm').toLowerCase();
    if (unit === 's') seconds = val;
    else if (unit === 'm') seconds = val * 60;
    else if (unit === 'h') seconds = val * 3600;
  }

  const timer = await request('/api/timers', {
    method: 'POST',
    body: JSON.stringify({
      title,
      duration_seconds: seconds,
      auto_start: true
    })
  });

  console.log(`✓ Timer started: "${timer.title}" for ${Math.round(seconds / 60)}m [${timer.id}]`);
}

async function handleList() {
  const items = await request('/api/items');
  console.log(`\nFree Form Items (${items.length}):\n`);
  for (const item of items.slice(0, 15)) {
    const typeTag = `[${item.type.toUpperCase()}]`;
    console.log(`  • ${typeTag.padEnd(12)} ${item.title} (${item.id})`);
  }
  console.log('');
}

async function main() {
  const command = remainingArgs[0];
  const cmdArgs = remainingArgs.slice(1);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'new':
      case 'add':
      case 'import':
        await handleNew(cmdArgs);
        break;
      case 'count':
        await handleCount(cmdArgs);
        break;
      case 'timer':
        await handleTimer(cmdArgs);
        break;
      case 'list':
      case 'ls':
        await handleList();
        break;
      default:
        console.error(`Unknown command: "${command}". Run "freeform --help" for usage.`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
