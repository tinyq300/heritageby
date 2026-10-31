'use strict';

let chatSession = null;

function startChat() {
    const heroine = heroines[currentHeroineId];
    if (!heroine) return;
    if (chatSession) chatSession.controller?.abort();
    chatSession = { heroineId: currentHeroineId, history: [], busy: false, controller: null, opener: document.activeElement };
    document.getElementById('chatTitle').textContent = heroine.name;
    document.getElementById('chatEraBadge').textContent = heroine.era;
    document.getElementById('chatHeroineAvatar').src = heroine.img;
    document.getElementById('chatHeroineAvatar').alt = heroine.imageAlt || heroine.name;
    document.getElementById('chatHeroineAvatar').style.objectPosition = heroine.imagePosition || 'center';
    document.getElementById('chatMessages').replaceChildren();
    document.getElementById('chatInput').value = '';
    document.getElementById('sendButton').disabled = false;
    document.getElementById('chatOverlay').classList.add('active');
    document.body.classList.add('modal-open');
    showTyping(false);
    addMessage('bot', heroine.greeting);
    document.getElementById('chatInput').focus();
}

function closeChat() {
    const opener = chatSession?.opener;
    chatSession?.controller?.abort();
    chatSession = null;
    document.getElementById('chatOverlay').classList.remove('active');
    if (!document.getElementById('detailModal').classList.contains('active')) document.body.classList.remove('modal-open');
    showTyping(false);
    opener?.focus();
}

function showTyping(show) {
    const indicator = document.getElementById('typingIndicator');
    const heroine = chatSession && heroines[chatSession.heroineId];
    indicator.textContent = heroine ? `${heroine.name} готовит ответ…` : '';
    indicator.classList.toggle('active', show);
}

function addMessage(sender, text, source = '') {
    const box = document.getElementById('chatMessages');
    const message = document.createElement('div');
    message.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    message.appendChild(content);
    if (source === 'reference') {
        const caption = document.createElement('small');
        caption.textContent = 'Из исторической справки';
        caption.style.cssText = 'display:block;margin:5px 8px;color:#75695e;font-size:0.8rem';
        message.appendChild(caption);
    }
    box.appendChild(message);
    box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
    const session = chatSession;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!session || session.busy || !text || text.length > 1200) return;
    const heroine = heroines[session.heroineId];
    session.busy = true;
    session.controller = new AbortController();
    input.value = '';
    document.getElementById('sendButton').disabled = true;
    addMessage('user', text);
    showTyping(true);
    let answer = HeritageChat.localReply(text, heroine, session.history);
    let source = 'reference';
    const decision = HeritageChat.classify(text, heroine, session.history);
    let timeout;
    try {
        if (decision.kind === 'topic' && location.protocol !== 'file:') {
            timeout = setTimeout(() => session.controller.abort(), 16000);
            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ heroineId: session.heroineId, message: text, history: session.history }),
                signal: session.controller.signal
            });
            if (response.ok) {
                const result = await response.json();
                if (typeof result.answer === 'string' && result.answer.trim() && result.answer.length <= 2500) {
                    answer = result.answer;
                    source = result.source === 'ai' ? 'ai' : 'reference';
                }
            }
        }
    } catch {
        // A static host, timeout or network error keeps the grounded reference reply.
    } finally {
        clearTimeout(timeout);
        if (chatSession === session) {
            showTyping(false);
            addMessage('bot', answer, source);
            if (['topic', 'identity'].includes(decision.kind)) {
                session.history.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
                session.history = session.history.slice(-8);
            }
            session.busy = false;
            document.getElementById('sendButton').disabled = false;
            input.focus();
        }
    }
}

document.addEventListener('keydown', event => {
    if (!chatSession) return;
    if (event.key === 'Escape') { closeChat(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...document.querySelectorAll('#chatOverlay button, #chatOverlay input')].filter(el => !el.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

// Old widget links share the gallery's chat instead of a second implementation.
{
    const requestedHeroine = new URLSearchParams(location.search).get('chat');
    if (requestedHeroine && Object.hasOwn(heroines, requestedHeroine)) {
        currentHeroineId = requestedHeroine;
        startChat();
    }
}
