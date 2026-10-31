'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { answerChat } = require('../api/chat-service.cjs');
const ORIGIN = 'https://tinyq300.github.io';
const request = (body, origin = ORIGIN, headers = {}) => new Request('https://api.example/api/chat', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers },
    body: JSON.stringify(body)
});
const question = { heroineId: 'euphrosyne', message: 'Расскажи о кресте' };
async function worker(fetchImpl) {
    const { createWorker } = await import('../api/worker-runtime.mjs');
    return createWorker({ answerChat, fetchImpl });
}

test('API: браузерный CORS preflight разрешает только сайт владельца', async () => {
    const api = await worker();
    const allowed = await api.fetch(new Request('https://api.example/api/chat', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } }));
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'), null);
    const denied = await api.fetch(request(question, 'https://other.example'));
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('API: состояние сообщает готовность без раскрытия ключа', async () => {
    const api = await worker();
    const noKey = await api.fetch(new Request('https://api.example/health'));
    assert.equal((await noKey.json()).ready, false);
    const configured = await api.fetch(new Request('https://api.example/health'), { OPENROUTER_API_KEY: 'test-secret' });
    const text = await configured.text();
    assert.equal(JSON.parse(text).ready, true);
    assert.ok(!text.includes('test-secret'));
});

test('API: без ключа отвечает справка, с ключом работает модель', async () => {
    let calls = 0;
    const api = await worker(async (url, options) => {
        calls++;
        const payload = JSON.parse(options.body);
        assert.equal(payload.model, 'openrouter/free');
        assert.equal(options.headers.Authorization, 'Bearer test-secret');
        assert.match(payload.messages[0].content, /Евфросиния Полоцкая/);
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ onTopic: true, answer: 'В 1161 году Лазарь Богша создал крест.', factIds: ['euphrosyne-3'] }) } }] }) };
    });
    assert.equal((await (await api.fetch(request(question))).json()).source, 'reference');
    assert.equal(calls, 0);
    const response = await api.fetch(request(question), { OPENROUTER_API_KEY: 'test-secret' });
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    const result = await response.json();
    assert.equal(result.source, 'ai');
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(result).includes('test-secret'));
});

test('API: некорректные и слишком большие запросы не попадают в модель', async () => {
    const api = await worker(() => { throw new Error('Unexpected provider call'); });
    assert.equal((await api.fetch(request({ heroineId: 'missing', message: 'hi' }))).status, 400);
    const large = request({ ...question, message: 'я'.repeat(13000) });
    assert.equal((await api.fetch(large)).status, 413);
    const broken = new Request('https://api.example/api/chat', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal((await api.fetch(broken)).status, 400);
});

test('API: ограничение частоты работает до обращения к модели', async () => {
    const api = await worker();
    for (let i = 0; i < 15; i++) assert.equal((await api.fetch(request(question))).status, 200);
    assert.equal((await api.fetch(request(question))).status, 429);
});

test('Собранный API является самостоятельным Worker и сохраняет историческую базу', async () => {
    const root = join(__dirname, '..');
    execFileSync(process.execPath, ['scripts/build-api.cjs'], { cwd: root });
    const source = readFileSync(join(root, 'dist-api/index.js'), 'utf8');
    const { default: api } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const response = await api.fetch(request(question));
    assert.equal(response.status, 200);
    assert.match((await response.json()).answer, /1161/);
});
