/**
 * ==========================================================================
 * МОДУЛЬ ДОСТУПНОСТИ (РЕЖИМ ДЛЯ СЛАБОВИДЯЩИХ)
 * Соответствие стандарту WCAG 2.1 AA и ГОСТ доступности
 * Проект «Вечные Образы: Наследие Женщин Беларуси»
 * ==========================================================================
 */

(function () {
    'use strict';

    // Конфигурация и состояние по умолчанию
    const STORAGE_KEY = 'heritageby_a11y_settings';

    const defaultState = {
        active: false,
        theme: 'wb',       // 'wb' (black on white), 'bw' (white on black), 'by' (yellow on blue), 'bb' (brown on beige)
        font: 'normal',    // 'normal', 'large', 'xlarge'
        sans: true,        // шрифт без засечек для максимальной читаемости
        spacing: 'normal', // 'normal', 'wide'
        images: 'on',      // 'on', 'gray', 'off'
        speechActive: false
    };

    let state = Object.assign({}, defaultState);

    // Загрузка настроек из localStorage
    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                state = Object.assign({}, defaultState, JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Не удалось прочитать настройки a11y из localStorage:', e);
        }
    }

    // Сохранение настроек в localStorage
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Не удалось сохранить настройки a11y в localStorage:', e);
        }
    }

    // Применение CSS-классов к тегу body в соответствии с состоянием
    function applyStyles() {
        const body = document.body;
        if (!body) return;

        if (!state.active) {
            // Очищаем все классы доступности
            body.classList.remove(
                'a11y-active',
                'a11y-theme-wb',
                'a11y-theme-bw',
                'a11y-theme-by',
                'a11y-theme-bb',
                'a11y-font-normal',
                'a11y-font-large',
                'a11y-font-xlarge',
                'a11y-sans',
                'a11y-spacing-normal',
                'a11y-spacing-wide',
                'a11y-img-on',
                'a11y-img-gray',
                'a11y-img-off'
            );
            stopSpeech();
            updateUIButtons();
            return;
        }

        body.classList.add('a11y-active');

        // Темы
        body.classList.remove('a11y-theme-wb', 'a11y-theme-bw', 'a11y-theme-by', 'a11y-theme-bb');
        body.classList.add(`a11y-theme-${state.theme}`);

        // Шрифт
        body.classList.remove('a11y-font-normal', 'a11y-font-large', 'a11y-font-xlarge');
        body.classList.add(`a11y-font-${state.font}`);

        // Без засечек
        if (state.sans) {
            body.classList.add('a11y-sans');
        } else {
            body.classList.remove('a11y-sans');
        }

        // Интервал
        body.classList.remove('a11y-spacing-normal', 'a11y-spacing-wide');
        body.classList.add(`a11y-spacing-${state.spacing}`);

        // Изображения
        body.classList.remove('a11y-img-on', 'a11y-img-gray', 'a11y-img-off');
        body.classList.add(`a11y-img-${state.images}`);

        updateUIButtons();
    }

    // Обновление подсветки активных кнопок в панели инструментов
    function updateUIButtons() {
        const toolbar = document.getElementById('a11y-toolbar');
        if (!toolbar) return;

        // Размер шрифта
        toolbar.querySelectorAll('[data-font]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-font') === state.font);
        });

        // Цветовые схемы
        toolbar.querySelectorAll('[data-theme]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === state.theme);
        });

        // Изображения
        toolbar.querySelectorAll('[data-images]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-images') === state.images);
        });

        // Без засечек
        const btnSans = toolbar.querySelector('[data-sans]');
        if (btnSans) btnSans.classList.toggle('active', state.sans);

        // Интервал
        const btnSpacing = toolbar.querySelector('[data-spacing]');
        if (btnSpacing) btnSpacing.classList.toggle('active', state.spacing === 'wide');

        // Озвучка
        const btnSpeech = toolbar.querySelector('#a11y-speech-btn');
        if (btnSpeech) {
            if (isSpeaking) {
                btnSpeech.classList.add('active');
                btnSpeech.innerHTML = '⏹ Остановить чтение';
            } else {
                btnSpeech.classList.remove('active');
                btnSpeech.innerHTML = '🔊 Озвучить страницу';
            }
        }
    }

    // Создание DOM-структуры панели инструментов и кнопки запуска
    function buildDOM() {
        if (document.getElementById('a11y-toolbar')) return;

        // 1. Плавающая кнопка быстрого вызова
        const triggerBtn = document.createElement('button');
        triggerBtn.id = 'a11y-trigger-btn';
        triggerBtn.setAttribute('aria-label', 'Включить версию сайта для слабовидящих (Alt+A)');
        triggerBtn.title = 'Версия для слабовидящих (Alt+A)';
        triggerBtn.innerHTML = '👁️ Версия для слабовидящих';
        triggerBtn.onclick = () => {
            state.active = true;
            saveState();
            applyStyles();
            announce('Режим для слабовидящих включен');
        };
        document.body.appendChild(triggerBtn);

        // 2. Верхняя панель инструментов
        const toolbar = document.createElement('aside');
        toolbar.id = 'a11y-toolbar';
        toolbar.setAttribute('role', 'region');
        toolbar.setAttribute('aria-label', 'Панель настроек доступности для слабовидящих');
        toolbar.innerHTML = `
            <!-- Размер шрифта -->
            <div class="a11y-controls-group">
                <span class="a11y-group-label">Размер шрифта:</span>
                <button class="a11y-btn" data-font="normal" title="Стандартный размер текста" onclick="window.a11y.setFont('normal')">A</button>
                <button class="a11y-btn" data-font="large" title="Крупный текст (120%)" onclick="window.a11y.setFont('large')">A+</button>
                <button class="a11y-btn" data-font="xlarge" title="Экстра-крупный текст (140%)" onclick="window.a11y.setFont('xlarge')">A++</button>
            </div>

            <!-- Цвета сайта -->
            <div class="a11y-controls-group">
                <span class="a11y-group-label">Цвет:</span>
                <button class="a11y-btn" data-theme="wb" title="Черным по белому" onclick="window.a11y.setTheme('wb')">⚪⚫ Ч/Б</button>
                <button class="a11y-btn" data-theme="bw" title="Белым по черному" onclick="window.a11y.setTheme('bw')">⚫⚪ Инверсия</button>
                <button class="a11y-btn" data-theme="by" title="Желтым по синему (спектральный контраст)" onclick="window.a11y.setTheme('by')">🔵🟡 Синий</button>
                <button class="a11y-btn" data-theme="bb" title="Коричневым по бежевому (комфортный)" onclick="window.a11y.setTheme('bb')">🟤🌾 Сепия</button>
            </div>

            <!-- Изображения -->
            <div class="a11y-controls-group">
                <span class="a11y-group-label">Картинки:</span>
                <button class="a11y-btn" data-images="on" title="Цветные изображения" onclick="window.a11y.setImages('on')">Вкл</button>
                <button class="a11y-btn" data-images="gray" title="Черно-белые изображения" onclick="window.a11y.setImages('gray')">Ч/Б</button>
                <button class="a11y-btn" data-images="off" title="Отключить изображения" onclick="window.a11y.setImages('off')">Выкл</button>
            </div>

            <!-- Дополнительно (шрифт и интервал) -->
            <div class="a11y-controls-group">
                <button class="a11y-btn" data-sans title="Переключить шрифт без засечек" onclick="window.a11y.toggleSans()">Гротеск (Arial)</button>
                <button class="a11y-btn" data-spacing title="Увеличенный интервал между буквами и строками" onclick="window.a11y.toggleSpacing()">Интервал</button>
            </div>

            <!-- Озвучивание речи (Синтезатор речи) -->
            <div class="a11y-controls-group">
                <button class="a11y-btn" id="a11y-speech-btn" title="Озвучить страницу или выделенный фрагмент (Alt+S)" onclick="window.a11y.toggleSpeech()">
                    🔊 Озвучить страницу
                </button>
            </div>

            <!-- Закрыть режим доступности -->
            <div class="a11y-controls-group">
                <button class="a11y-btn a11y-close-btn" title="Вернуться к обычной версии сайта" onclick="window.a11y.disable()">
                    ✕ Обычная версия
                </button>
            </div>
        `;

        document.body.insertBefore(toolbar, document.body.firstChild);
    }

    // Сообщение для экранных дикторов
    function announce(text) {
        let liveRegion = document.getElementById('a11y-live-announcer');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'a11y-live-announcer';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.style.position = 'absolute';
            liveRegion.style.left = '-9999px';
            document.body.appendChild(liveRegion);
        }
        liveRegion.textContent = text;
    }

    // ==========================================================================
    // ВСТРОЕННЫЙ СИНТЕЗАТОР РЕЧИ (WEB SPEECH API / TTS)
    // ==========================================================================
    let isSpeaking = false;
    let speechQueue = [];
    let currentUtterance = null;

    function initSpeech() {
        if (!('speechSynthesis' in window)) {
            console.warn('SpeechSynthesis не поддерживается в данном браузере.');
            const speechBtn = document.getElementById('a11y-speech-btn');
            if (speechBtn) speechBtn.style.display = 'none';
            return;
        }
    }

    function toggleSpeech() {
        if (isSpeaking) {
            stopSpeech();
        } else {
            startSpeech();
        }
    }

    function startSpeech() {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        // 1. Проверяем, выделил ли пользователь фрагмент текста
        let textToRead = '';
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            textToRead = selection.toString().trim();
        } else {
            // 2. Иначе собираем основной текст страницы (заголовки, параграфы, цитаты)
            const mainContent = document.querySelector('main, .gallery-container, .timeline-container, .container, body');
            if (mainContent) {
                const elements = mainContent.querySelectorAll('h1, h2, h3, h4, p, .heroine-name, .heroine-years, .quote-text, .detail-quote, .story-text');
                const textParts = [];
                elements.forEach(el => {
                    // Игнорируем элементы внутри панели инструментов доступности
                    if (el.closest('#a11y-toolbar')) return;
                    const text = el.innerText ? el.innerText.trim() : '';
                    if (text && text.length > 2) {
                        textParts.push(text);
                    }
                });
                textToRead = textParts.join('. ');
            }
        }

        if (!textToRead) {
            announce('Текст для озвучивания не найден');
            return;
        }

        // Разбиваем длинный текст на предложения для плавной речи
        const sentences = textToRead.match(/[^.!?]+[.!?]+|\S+/g) || [textToRead];
        speechQueue = sentences.map(s => s.trim()).filter(s => s.length > 0);

        if (speechQueue.length === 0) return;

        isSpeaking = true;
        updateUIButtons();
        playNextSentence();
    }

    function playNextSentence() {
        if (!isSpeaking || speechQueue.length === 0) {
            stopSpeech();
            return;
        }

        const sentence = speechQueue.shift();
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'ru-RU';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Выбираем русский голос, если доступен
        const voices = window.speechSynthesis.getVoices();
        const ruVoice = voices.find(v => v.lang.startsWith('ru') || v.lang.startsWith('be'));
        if (ruVoice) utterance.voice = ruVoice;

        utterance.onend = () => {
            if (isSpeaking) {
                playNextSentence();
            }
        };

        utterance.onerror = () => {
            if (isSpeaking) {
                playNextSentence();
            }
        };

        currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }

    function stopSpeech() {
        isSpeaking = false;
        speechQueue = [];
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        updateUIButtons();
    }

    // ==========================================================================
    // ПУБЛИЧНЫЙ API ДЛЯ ВЗАИМОДЕЙСТВИЯ
    // ==========================================================================
    window.a11y = {
        enable: function () {
            state.active = true;
            saveState();
            applyStyles();
            announce('Режим для слабовидящих включен');
        },
        disable: function () {
            state.active = false;
            saveState();
            applyStyles();
            announce('Режим для слабовидящих отключен, возврат к обычной версии');
        },
        toggle: function () {
            if (state.active) this.disable();
            else this.enable();
        },
        setFont: function (size) {
            state.font = size;
            saveState();
            applyStyles();
            announce(`Размер шрифта: ${size}`);
        },
        setTheme: function (themeKey) {
            state.theme = themeKey;
            saveState();
            applyStyles();
            announce(`Цветовая схема изменена`);
        },
        setImages: function (mode) {
            state.images = mode;
            saveState();
            applyStyles();
            announce(`Режим картинок: ${mode}`);
        },
        toggleSans: function () {
            state.sans = !state.sans;
            saveState();
            applyStyles();
            announce(state.sans ? 'Шрифт без засечек включен' : 'Шрифт по умолчанию');
        },
        toggleSpacing: function () {
            state.spacing = state.spacing === 'wide' ? 'normal' : 'wide';
            saveState();
            applyStyles();
            announce(state.spacing === 'wide' ? 'Увеличенный интервал включен' : 'Обычный интервал');
        },
        toggleSpeech: function () {
            toggleSpeech();
        },
        getState: function () {
            return Object.assign({}, state);
        }
    };

    // ==========================================================================
    // ГОРЯЧИЕ КЛАВИШИ
    // ==========================================================================
    window.addEventListener('keydown', function (e) {
        // Alt + A : Переключение режима доступности
        if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф')) {
            e.preventDefault();
            window.a11y.toggle();
        }
        // Alt + S : Озвучивание
        if (e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы')) {
            e.preventDefault();
            window.a11y.toggleSpeech();
        }
    });

    // ==========================================================================
    // ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
    // ==========================================================================
    loadState();

    function init() {
        buildDOM();
        initSpeech();
        applyStyles();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
