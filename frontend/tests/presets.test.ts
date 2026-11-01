import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { presetCatalog, loadPreset } from '../src/presets/catalog';
import { parseConfig } from '../src/config/validate';
import { isKnownType } from '../src/catalog/catalog';

const directory = new URL('../public/presets/', import.meta.url);
const read = (id: string) => readFileSync(new URL(`${id}.json`, directory), 'utf8');

test('infrastructure, Umbraco, business, and workflow presets are discoverable', () => {
  assert.equal(presetCatalog.length, 16);
  assert.equal(presetCatalog.filter(preset => !preset.source).length, 15);
  assert.equal(new Set(presetCatalog.map(preset => preset.id)).size, 16);
  assert.deepEqual(readdirSync(directory).filter(name => name !== 'index.json').sort(), presetCatalog.map(p => `${p.id}.json`).sort());
  for (const preset of presetCatalog) assert.match(preset.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('all shipped presets validate, round-trip, and have accurate picker counts', () => {
  for (const preset of presetCatalog) {
    const { config, warnings } = parseConfig(read(preset.id));
    assert.deepEqual(warnings, [], preset.id);
    assert.equal(config.groups.length, preset.groups, preset.id);
    assert.equal(config.objects.length, preset.objects, preset.id);
    assert.equal(config.connections.length, preset.connections, preset.id);
    assert.ok(config.objects.every(object => isKnownType(object.type ?? 'container', config.objectTypes)));
    assert.ok(config.objects.every(object => object.description?.trim()));
    assert.ok(config.groups.every(group => config.objects.some(object => object.group === group.id)));
    assert.ok(config.connections.every(connection => connection.label?.trim()));
    assert.deepEqual(parseConfig(JSON.stringify(config)).config, config);
  }
});

test('preset loading respects subdirectory hosting and produces independent editable documents', async () => {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    return new Response(read('web-application'));
  };
  const first = await loadPreset('web-application', '/explorer/', undefined, fetcher);
  first.presentation.headline = 'My changes';
  first.objects[0].name = 'Changed';
  const second = await loadPreset('web-application', '/explorer', undefined, fetcher);
  assert.deepEqual(calls, ['/explorer/presets/web-application.json', '/explorer/presets/web-application.json']);
  assert.notEqual(first.presentation.headline, second.presentation.headline);
  assert.notEqual(first.objects[0].name, second.objects[0].name);
});

test('unregistered preset IDs are rejected before any fetch', async () => {
  let fetched = false;
  await assert.rejects(loadPreset('../architecture', '/', undefined, async () => { fetched = true; return new Response('{}'); }), /Unknown architecture preset/);
  assert.equal(fetched, false);
});

test('failed requests and malformed preset documents are reported without returning a config', async () => {
  await assert.rejects(loadPreset('web-application', '/', undefined, async () => new Response('', { status: 404 })), /Could not load.*404/);
  await assert.rejects(loadPreset('web-application', '/', undefined, async () => new Response('{broken')), /Invalid JSON/);
  const broken = JSON.parse(read('web-application'));
  broken.connections[0].to = 'missing';
  await assert.rejects(loadPreset('web-application', '/', undefined, async () => new Response(JSON.stringify(broken))), /unknown object/);
  broken.connections[0].to = 'cdn'; broken.objects[0].type = 'unregistered';
  await assert.rejects(loadPreset('web-application', '/', undefined, async () => new Response(JSON.stringify(broken))), /Preset needs updating/);
});

test('cancelled picker requests pass cancellation through to fetch', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadPreset('web-application', '/', controller.signal, async (_url, options) => {
    assert.equal(options?.signal, controller.signal);
    options?.signal?.throwIfAborted();
    return new Response(read('web-application'));
  }), { name: 'AbortError' });
});

test('Umbraco models the checked-in Cluster demo rather than mixing alternative template modes', () => {
  const { config } = parseConfig(read('umbraco-topology'));
  const byId = new Map(config.objects.map(object => [object.id, object]));
  assert.deepEqual(['cm', 'cd1', 'cd2'].map(id => byId.get(id)?.type), ['container', 'container', 'container']);
  assert.equal(byId.get('yarp')?.type, 'reverse-proxy');
  assert.equal(byId.get('sql-cache')?.type, 'cache');
  assert.match(byId.get('sql-cache')!.description!, /not a separate server/);
  assert.ok(config.connections.some(c => c.from === 'sql-cache' && c.to === 'sql'));
  assert.ok(!byId.has('single') && !byId.has('redis') && !byId.has('azurite'));
  assert.deepEqual(config.connections.filter(c => c.from === 'astro'), []);
  assert.deepEqual(config.connections.filter(c => c.to === 'astro').map(c => c.from).sort(), ['apphost', 'visitor']);
  const source = presetCatalog.find(p => p.id === 'umbraco-topology')!.source!;
  assert.match(source.revision, /^[a-f0-9]{40}$/);
  assert.ok(source.url.includes(source.revision));
});
