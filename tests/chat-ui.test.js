'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const heroines = require('../js/heroines.js');
const policy = require('../js/chat-policy.js');

function ui(fetchImpl, config) {
    const nodes = new Map();
    function element() {
        const classes = new Set();
        return { children: [], value: '', disabled: false, textContent: '', style: {},
            classList: { add: s => classes.add(s), remove: s => classes.delete(s), contains: s => classes.has(s), toggle: (s, on) => on ? classes.add(s) : classes.delete(s) },
            appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; }, focus() {} };
    }
    const document = { activeElement: { focus() {} }, body: element(),
        getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
        createElement: element, addEventListener() {} };
    const context = vm.createContext({ document, heroines, currentHeroineId: 'euphrosyne', HeritageChat: policy,
        location: { protocol: 'http:', search: '', hostname: config ? 'tinyq300.github.io' : 'localhost' },
        HeritageChatConfig: config, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: fetchImpl });
    vm.runInContext(fs.readFileSync(require.resolve('../js/chat.js'), 'utf8'), context);
    return { context, document, nodes };
}

test('повторная отправка во время запроса не создаёт дубликаты', async () => {
    let complete, requests = 0;
    const page = ui(() => { requests++; return new Promise(resolve => { complete = resolve; }); });
    page.context.startChat();
    page.document.getElementById('chatInput').value = 'Расскажи про крест';
    const first = page.context.sendMessage();
    page.document.getElementById('chatInput').value = 'Расскажи про монастырь';
    await page.context.sendMessage();
    assert.equal(requests, 1);
    assert.equal(page.nodes.get('chatMessages').children.length, 2);
    complete({ ok: true, json: async () => ({ answer: 'Крест создан в 1161 году.', source: 'ai' }) });
    await first;
    assert.equal(page.nodes.get('chatMessages').children.length, 3);
    assert.equal(page.nodes.get('sendButton').disabled, false);
});

test('ответ закрытой беседы не попадает в окно другой героини', async () => {
    let complete;
    const page = ui(() => new Promise(resolve => { complete = resolve; }));
    page.context.startChat();
    page.document.getElementById('chatInput').value = 'Расскажи про крест';
    const pending = page.context.sendMessage();
    page.context.closeChat();
    page.context.currentHeroineId = 'marina';
    page.context.startChat();
    complete({ ok: true, json: async () => ({ answer: 'Старый ответ Евфросинии', source: 'ai' }) });
    await pending;
    const messages = page.nodes.get('chatMessages').children;
    assert.equal(messages.length, 1);
    assert.ok(messages[0].children[0].textContent.includes('Марина'));
    assert.equal(page.nodes.get('sendButton').disabled, false);
});

test('HTML пользователя отображается как текст', async () => {
    const page = ui(() => { throw new Error('No provider needed'); });
    page.context.startChat();
    const payload = '<img src=x onerror=alert(1)>';
    page.document.getElementById('chatInput').value = payload;
    await page.context.sendMessage();
    const message = page.nodes.get('chatMessages').children[1].children[0];
    assert.equal(message.textContent, payload);
    assert.equal(message.innerHTML, undefined);
});

test('GitHub Pages отправляет вопросы в HTTPS API без браузерных ключей и cookies', async () => {
    let sent;
    const page = ui(async (url, options) => {
        sent = { url, ...options };
        return { ok: true, json: async () => ({ answer: 'Крест создан в 1161 году.', source: 'ai' }) };
    }, { apiBaseUrl: 'https://example.chatgpt.site' });
    page.context.startChat();
    page.document.getElementById('chatInput').value = 'Расскажи про крест';
    await page.context.sendMessage();
    assert.equal(sent.url, 'https://example.chatgpt.site/api/chat');
    assert.equal(sent.credentials, 'omit');
    assert.equal(sent.headers.Authorization, undefined);
    assert.equal(JSON.parse(sent.body).heroineId, 'euphrosyne');
    assert.match(page.nodes.get('chatMessages').children.at(-1).children[1].textContent, /Ответ ИИ/);
});

test('вопрос без совпадения по словам доходит до API, знакомство остаётся доступным сразу', async () => {
    let requests = 0;
    const page = ui(async () => {
        requests++;
        return { ok: true, json: async () => ({ answer: 'Я переписывала книги.', source: 'ai' }) };
    });
    page.context.startChat();
    page.document.getElementById('chatInput').value = 'кто ты такая?';
    await page.context.sendMessage();
    assert.equal(requests, 0);
    assert.match(page.nodes.get('chatMessages').children.at(-1).children[0].textContent, /Евфросиния/);
    page.document.getElementById('chatInput').value = 'Как вы зарабатывали на жизнь?';
    await page.context.sendMessage();
    assert.equal(requests, 1);
    assert.match(page.nodes.get('chatMessages').children.at(-1).children[1].textContent, /Ответ ИИ/);
});
