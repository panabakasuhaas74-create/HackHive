/* ============================================
   CHAT APPLICATION MAIN SCRIPT
   ============================================ */

// ============ DOM ELEMENTS ============

// Main containers
const mainContainer = document.getElementById('mainContainer');
const searchArea = document.getElementById('searchArea');
const chatWrapper = document.getElementById('chatWrapper');
const inputArea = document.getElementById('inputArea');

// Primary input (centered)
const searchInput = document.getElementById('searchInput');
const sendBtn = document.getElementById('sendBtn');
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const removePreview = document.getElementById('removePreview');

// Secondary input (bottom)
const searchInputBottom = document.getElementById('searchInputBottom');
const sendBtnBottom = document.getElementById('sendBtnBottom');
const uploadBtnBottom = document.getElementById('uploadBtnBottom');
const imageInputBottom = document.getElementById('imageInputBottom');
const previewContainerBottom = document.getElementById('previewContainerBottom');
const imagePreviewBottom = document.getElementById('imagePreviewBottom');
const removePreviewBottom = document.getElementById('removePreviewBottom');

// Chat elements
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');
const resetChatBtn = document.getElementById('resetChat');

// Settings
const settingsIcon = document.getElementById('settingsIcon');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const themeToggle = document.getElementById('themeToggle');
const fontSizeSelect = document.getElementById('fontSizeSelect');
const animToggle = document.getElementById('animToggle');

// ============ STATE MANAGEMENT ============

// Markdown rendering helper (requires marked & DOMPurify from CDN)
function renderMarkdown(text) {
    if (!text) return '';
    try {
        // enable GFM and treat single line breaks as <br>
        marked.setOptions({ gfm: true, breaks: true });
        const raw = marked.parse(text);
        return DOMPurify.sanitize(raw);
    } catch (e) {
        console.warn('Markdown rendering failed', e);
        // fallback escape
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}


let chatStarted = false;
let selectedImage = null;
let selectedImageBottom = null;
let conversationHistory = [];
let responseSpeedMode = 'instant'; // 'instant' or 'typing'
// Tracks whether the user is currently scrolled near the bottom (~100px)
let isUserNearBottom = true;

// Favorites state
let messageIdCounter = 0;
let favorites = [];

function loadFavorites() {
    try {
        return JSON.parse(localStorage.getItem('favorites') || '[]');
    } catch (e) { return []; }
}

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeSettings();
    attachEventListeners();
});

// ============ EVENT LISTENERS ============

function attachEventListeners() {
    // Primary input events
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
    uploadBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageSelect);
    removePreview.addEventListener('click', removeSelectedImage);

    // Secondary input events
    searchInputBottom.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtnBottom.addEventListener('click', sendMessage);
    uploadBtnBottom.addEventListener('click', () => imageInputBottom.click());
    imageInputBottom.addEventListener('change', handleImageSelectBottom);
    removePreviewBottom.addEventListener('click', removeSelectedImageBottom);

    // Settings events
    settingsIcon.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsPanel);
    themeToggle.addEventListener('change', toggleTheme);

    // Reset chat
    resetChatBtn.addEventListener('click', resetChat);

    // Font size selection
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', () => applyFontSize(fontSizeSelect.value));
    }

    // Response speed selector (replaces old animations checkbox)
    if (animToggle) {
        // animToggle is now a select for response speed ('instant' | 'typing')
        animToggle.addEventListener('change', () => applyResponseSpeed(animToggle.value));
    }
    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.settings-panel') && 
            !e.target.closest('.settings-icon')) {
            closeSettingsPanel();
        }
    });

    // Prompt Library items in the left sidebar
    const promptItems = document.querySelectorAll('.prompt-item');
    if (promptItems && promptItems.length) {
        promptItems.forEach((item) => {
            item.addEventListener('click', () => {
                const promptText = item.getAttribute('data-prompt') || '';
                insertPrompt(promptText);
                // focus whichever input is currently visible
                const input = document.getElementById('searchInput') ||
                              document.getElementById('searchInputBottom');
                if (input) {
                    input.focus();
                }
            });
        });
    }

    // AI Hint Generator button handling
    const hintButtons = document.querySelectorAll('.hint-item');
    if (hintButtons && hintButtons.length) {
        hintButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const hintText = btn.getAttribute('data-prompt') || '';
                insertPrompt(hintText);
                const input = document.getElementById('searchInput') ||
                              document.getElementById('searchInputBottom');
                if (input) input.focus();
            });
        });
    }

    // Code Analyzer button handling (bottom of sidebar)
    const analyzerBtn = document.querySelector('.analyzer-item');
    if (analyzerBtn) {
        analyzerBtn.addEventListener('click', () => {
            const text = analyzerBtn.getAttribute('data-prompt') || '';
            insertPrompt(text);
            const input = document.getElementById('searchInput') ||
                          document.getElementById('searchInputBottom');
            if (input) input.focus();
        });
    }

    // inject Favorites UI under prompt library (if not present)
    try {
        const leftSidebar = document.getElementById('leftSidebar');
        if (leftSidebar && !document.getElementById('favoritesContainer')) {
            const container = document.createElement('div');
            container.id = 'favoritesContainer';
            container.className = 'favorites';
            container.innerHTML = `
                <div class="favorites-title">⭐ Favorites</div>
                <div class="favorites-list" id="favoritesList"></div>
            `;
            leftSidebar.appendChild(container);
        }
    } catch (e) {
        console.warn('Favorites injection failed', e);
    }
    // load persisted favorites
    favorites = loadFavorites();
    renderFavoritesList();
    // inject Language Converter UI under favorites (if not present)
    try {
        const leftSidebar = document.getElementById('leftSidebar');
        if (leftSidebar && !document.getElementById('converterContainer')) {
            const conv = document.createElement('div');
            conv.id = 'converterContainer';
            conv.className = 'converter';
            conv.innerHTML = `
                <div class="converter-title">🔄 Language Converter</div>
                <div class="converter-row">
                    <select id="fromLangSelect" aria-label="From Language"></select>
                    <select id="toLangSelect" aria-label="To Language"></select>
                </div>
                <div class="converter-row">
                    <button id="convertCodeBtn" class="convert-btn">Convert Code</button>
                </div>
                <div id="converterWarning" class="converter-warning">From and To languages must differ.</div>
            `;
            leftSidebar.appendChild(conv);

            const langs = ['Python','C','C++','Java'];
            const fromSel = document.getElementById('fromLangSelect');
            const toSel = document.getElementById('toLangSelect');
            langs.forEach(l => {
                const o1 = document.createElement('option'); o1.value = l; o1.text = l; fromSel.appendChild(o1);
                const o2 = document.createElement('option'); o2.value = l; o2.text = l; toSel.appendChild(o2);
            });
            // defaults
            fromSel.value = 'Python';
            toSel.value = 'C';

            const warningEl = document.getElementById('converterWarning');
            const convertBtn = document.getElementById('convertCodeBtn');

            function validateConverter() {
                if (fromSel.value === toSel.value) {
                    warningEl.style.display = 'block';
                    convertBtn.disabled = true;
                } else {
                    warningEl.style.display = 'none';
                    convertBtn.disabled = false;
                }
            }

            fromSel.addEventListener('change', validateConverter);
            toSel.addEventListener('change', validateConverter);

            convertBtn.addEventListener('click', () => {
                const from = fromSel.value;
                const to = toSel.value;
                if (from === to) return validateConverter();
                const prompt = `Convert the following code from ${from} to ${to}.\nExplain the important differences after conversion.`;
                insertPrompt(prompt);
            });

            validateConverter();
        }
    } catch (e) { console.warn('Converter injection failed', e); }
}

// --------- Smart scroll detection (ChatGPT-like behavior) ---------
/**
 * Update `isUserNearBottom` based on current scroll position.
 */
function updateIsUserNearBottom() {
    try {
        if (!messagesContainer) {
            isUserNearBottom = true;
            return;
        }
        const threshold = 100; // px from bottom
        const scrollTop = messagesContainer.scrollTop;
        const clientHeight = messagesContainer.clientHeight;
        const scrollHeight = messagesContainer.scrollHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isUserNearBottom = distanceFromBottom < threshold;
    } catch (e) {
        isUserNearBottom = true;
    }
}

// Attach scroll listener to track manual scrolling (debounced for performance)
if (messagesContainer) {
    messagesContainer.addEventListener('scroll', debounce(updateIsUserNearBottom, 100));
    // initialize state
    window.requestAnimationFrame(updateIsUserNearBottom);
}

// Ensure we recalc when layout/resizes occur
window.addEventListener('resize', () => {
    adjustMessagesPadding();
    updateIsUserNearBottom();
});

// -----------------------------------------------------------------

// ============ MESSAGING SYSTEM ============

/**
 * Send a message to the chat
 */
async function sendMessage() {
    const inputElement = chatStarted ? searchInputBottom : searchInput;
    const text = inputElement.value.trim();
    const imageData = chatStarted ? selectedImageBottom : selectedImage;

    // Require either text or image
    if (!text && !imageData) return;

    // Start chat if first message
    if (!chatStarted) {
        startChat();
    }

    // Add user message to UI with image if present
    addMessage(text, 'user', imageData);
    conversationHistory.push({ role: 'user', content: text });

    // Clear input and reset image preview
    inputElement.value = '';
    inputElement.focus();
    if (chatStarted) {
        removeSelectedImageBottom();
    } else {
        removeSelectedImage();
    }

    // Show typing indicator while waiting for response
    showTypingIndicator();

    try {
        // call backend
        const reply = await sendToAPI(text, imageData);
        hideTypingIndicator();
        // display assistant reply according to chosen response speed
        await displayAssistantMessage(reply);
        conversationHistory.push({ role: 'assistant', content: reply });
    } catch (err) {
        hideTypingIndicator();
        addMessage('Server error. Make sure backend is running.', 'assistant');
        console.error(err);
    }
}

/**
 * Add a message to the conversation
 * @param {string} text - Message text
 * @param {string} sender - 'user' or 'assistant'
 * @param {string} imageData - Optional base64 image data
 */
function addMessage(text, sender, imageData = null) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper', sender);
    const msgId = `msg-${++messageIdCounter}`;
    messageWrapper.dataset.msgId = msgId;

    const message = document.createElement('div');
    message.classList.add('message', sender);
    
    // Add text if present (render as Markdown so newlines, code blocks, and formatting work)
    if (text) {
        message.innerHTML = renderMarkdown(text);
    }

    // Add image if present
    if (imageData) {
        const img = document.createElement('img');
        img.src = imageData;
        img.classList.add('message-image');
        img.alt = 'User uploaded image';
        message.appendChild(img);
    }

    messageWrapper.appendChild(message);
    messagesContainer.appendChild(messageWrapper);

    // add favorite toggle button
    try {
        const favBtn = document.createElement('button');
        favBtn.className = 'favorite-toggle';
        favBtn.title = 'Favorite';
        favBtn.innerText = isMessageFavorited(msgId, text) ? '⭐' : '☆';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(msgId, text, sender);
        });
        messageWrapper.appendChild(favBtn);
        // visual highlight if already favorited
        if (isMessageFavorited(msgId, text)) {
            message.classList.add('favorited');
        }
    } catch (e) { /* ignore */ }

    // Auto-scroll to newest message
    scrollToBottom();
}

/**
 * Display assistant message with optional typing effect.
 * Returns a Promise that resolves when the full text (and images) have been rendered.
 */
async function displayAssistantMessage(text, imageData = null) {
    // create elements like addMessage
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper', 'assistant');
    // assign a unique message id so favorites can reference assistant messages
    const msgId = `msg-${++messageIdCounter}`;
    messageWrapper.dataset.msgId = msgId;

    const message = document.createElement('div');
    message.classList.add('message', 'assistant');

    messagesContainer.appendChild(messageWrapper);
    messageWrapper.appendChild(message);

    // Instant mode: render immediately
    if (responseSpeedMode === 'instant') {
        if (text) {
            message.innerHTML = renderMarkdown(text);
        }
        if (imageData) {
            const img = document.createElement('img');
            img.src = imageData;
            img.classList.add('message-image');
            img.alt = 'Assistant image';
            message.appendChild(img);
        }
        scrollToBottom();
        // add favorite toggle for assistant message
        try {
            const favBtn = document.createElement('button');
            favBtn.className = 'favorite-toggle';
            favBtn.title = 'Favorite';
            favBtn.innerText = isMessageFavorited(messageWrapper.dataset.msgId, text) ? '⭐' : '☆';
            favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(messageWrapper.dataset.msgId, text, 'assistant'); });
            messageWrapper.appendChild(favBtn);
            if (isMessageFavorited(messageWrapper.dataset.msgId, text)) message.classList.add('favorited');
        } catch (e) {}
        return;
    }

    // Typing effect mode: reveal characters progressively
    const delayPerChar = 20; // ms per character — adjust for speed
    message.textContent = '';
    for (let i = 1; i <= (text ? text.length : 0); i++) {
        message.textContent = text.slice(0, i);
        scrollToBottom();
        // await between characters
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, delayPerChar));
    }
    // once typing animation completes convert to markdown HTML
    if (text) {
        message.innerHTML = renderMarkdown(text);
    }

    if (imageData) {
        const img = document.createElement('img');
        img.src = imageData;
        img.classList.add('message-image');
        img.alt = 'Assistant image';
        message.appendChild(img);
    }

    scrollToBottom();
    // attach favorite toggle (typing finished)
    try {
        const favBtn = document.createElement('button');
        favBtn.className = 'favorite-toggle';
        favBtn.title = 'Favorite';
        favBtn.innerText = isMessageFavorited(messageWrapper.dataset.msgId, text) ? '⭐' : '☆';
        favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(messageWrapper.dataset.msgId, text, 'assistant'); });
        messageWrapper.appendChild(favBtn);
        if (isMessageFavorited(messageWrapper.dataset.msgId, text)) message.classList.add('favorited');
    } catch (e) {}
}


/**
 * Show typing indicator
 */
function showTypingIndicator() {
    typingIndicator.classList.add('show');
    scrollToBottom();
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    typingIndicator.classList.remove('show');
}

/**
 * Auto-scroll to bottom of messages
 */
function scrollToBottom() {
    // ensure padding accounts for input height before scrolling
    adjustMessagesPadding();

    // Only auto-scroll when the user is already near the bottom.
    // If they have scrolled up (reading earlier messages), respect their position.
    if (!isUserNearBottom) return;

    setTimeout(() => {
        try {
            // Prefer smooth programmatic scroll
            messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
        } catch (e) {
            // Fallback to scrollTop
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 50); /* slight delay ensures DOM is fully rendered before scroll */
}

/**
 * Adjust bottom padding of messages container so last message isn't covered by input
 */
function adjustMessagesPadding() {
    try {
        const basePadding = 24; // matches CSS top padding
        const inputEl = document.getElementById('inputArea') || inputArea || null;
        let extra = 0;
        if (inputEl && inputEl.offsetHeight) {
            extra = inputEl.offsetHeight;
        }
        // Add a small safety margin so the last message is never obscured
        const safety = 8;
        if (messagesContainer) messagesContainer.style.paddingBottom = (basePadding + extra + safety) + 'px';
    } catch (e) {
        // ignore
    }
}

// Keep padding correct on resize and when inputs change
window.addEventListener('resize', adjustMessagesPadding);

/**
 * Reset chat conversation
 */
async function resetChat() {
    if (confirm('Are you sure you want to clear the conversation?')) {
        try {
            await fetch('/reset', { method: 'POST', credentials: 'include' });
        } catch (err) {
            console.warn('Reset endpoint error', err);
        }

        messagesContainer.innerHTML = '';
        // restore initial assistant greeting
        messagesContainer.innerHTML = '<div class="message assistant">Hello 👋 I\'m your Code Mentor. Ask me anything about coding!</div>';
        conversationHistory = [];
        chatStarted = false;

        // Hide chat UI
        chatWrapper.classList.remove('visible');
        inputArea.classList.remove('visible');
        searchArea.classList.remove('hidden');

        // Clear inputs
        searchInput.value = '';
        searchInputBottom.value = '';
        removeSelectedImage();
        removeSelectedImageBottom();

        // Reset focus
        searchInput.focus();
    }
}

// ============ CHAT STATE MANAGEMENT ============

/**
 * Start the chat (transition from centered to bottom input)
 */
function startChat() {
    chatStarted = true;

    // Hide search area
    searchArea.classList.add('hidden');

    // Show chat wrapper and input area
    setTimeout(() => {
        chatWrapper.classList.add('visible');
        inputArea.classList.add('visible');
        searchInputBottom.focus();
    }, 150);
}

// ============ IMAGE UPLOAD HANDLING ============

/**
 * Handle image selection from file input (centered)
 */
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImage = e.target.result;
        imagePreview.src = selectedImage;
        previewContainer.classList.add('show');
    };
    reader.readAsDataURL(file);
}

/**
 * Remove selected image (centered)
 */
function removeSelectedImage() {
    selectedImage = null;
    imageInput.value = '';
    previewContainer.classList.remove('show');
}

/**
 * Handle image selection from file input (bottom)
 */
function handleImageSelectBottom(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImageBottom = e.target.result;
        imagePreviewBottom.src = selectedImageBottom;
        previewContainerBottom.classList.add('show');
    };
    reader.readAsDataURL(file);
}

/**
 * Remove selected image (bottom)
 */
function removeSelectedImageBottom() {
    selectedImageBottom = null;
    imageInputBottom.value = '';
    previewContainerBottom.classList.remove('show');
}

// ============ SETTINGS & THEME ============

/**
 * Initialize theme from localStorage
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

/**
 * Apply theme to the document
 */
function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    themeToggle.checked = isDark;
    localStorage.setItem('theme', theme);
}

/**
 * Toggle theme between light and dark
 */
function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

/**
 * Initialize other UI settings (font size, animations)
 */
function initializeSettings() {
    // font size
    const savedSize = localStorage.getItem('fontSize') || 'medium';
    applyFontSize(savedSize);
    if (fontSizeSelect) fontSizeSelect.value = savedSize;

    // response speed mode (stored under 'responseSpeed')
    const savedSpeed = localStorage.getItem('responseSpeed') || 'instant';
    responseSpeedMode = savedSpeed;
    if (animToggle) animToggle.value = savedSpeed;
}

/**
 * Apply selected font size by adding class to body
 */
function applyFontSize(size) {
    if (!messagesContainer) return;
    // ensure messages container has the chat-container marker
    messagesContainer.classList.add('chat-container');
    // remove previous chat font classes
    messagesContainer.classList.remove('chat-font-small', 'chat-font-medium', 'chat-font-large');
    // add new chat font class
    messagesContainer.classList.add(`chat-font-${size}`);
    localStorage.setItem('fontSize', size);
}

/**
 * Apply response speed mode and persist choice
 */
function applyResponseSpeed(mode) {
    responseSpeedMode = mode === 'typing' ? 'typing' : 'instant';
    localStorage.setItem('responseSpeed', responseSpeedMode);
}

/**
 * Insert a prompt into the appropriate input (centered or bottom) and focus it.
 * Does NOT send the message automatically.
 */
function insertPrompt(text) {
    const targetInput = chatStarted ? searchInputBottom : searchInput;
    if (!targetInput) return;
    targetInput.value = text;
    targetInput.focus();
    // place caret at end
    try {
        targetInput.selectionStart = targetInput.selectionEnd = targetInput.value.length;
    } catch (e) {
        // some inputs may not support selection; ignore
    }
}

/* Favorites management */
function isMessageFavorited(msgId, text) {
    // Favorited by exact msgId or by exact text match
    if (!favorites || !favorites.length) return false;
    return favorites.some(f => f.id === msgId || f.text === text);
}

function toggleFavorite(msgId, text, sender) {
    const existingIndex = favorites.findIndex(f => f.id === msgId || f.text === text);
    if (existingIndex >= 0) {
        // remove
        const removed = favorites.splice(existingIndex, 1)[0];
        saveFavorites();
        renderFavoritesList();
        // update message UI
        const el = document.querySelector(`[data-msg-id="${removed.id}"]`);
        if (el) {
            const msg = el.querySelector('.message'); if (msg) msg.classList.remove('favorited');
            const btn = el.querySelector('.favorite-toggle'); if (btn) btn.innerText = '☆';
        }
        return;
    }

    // add new favorite
    const fav = { id: msgId, text: text, sender: sender, ts: Date.now() };
    favorites.push(fav);
    saveFavorites();
    renderFavoritesList();
    // update message UI
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
        const msg = el.querySelector('.message'); if (msg) msg.classList.add('favorited');
        const btn = el.querySelector('.favorite-toggle'); if (btn) btn.innerText = '⭐';
    }
}

function renderFavoritesList() {
    const list = document.getElementById('favoritesList');
    if (!list) return;
    list.innerHTML = '';
    favorites.forEach((f) => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.dataset.favId = f.id;
        const text = document.createElement('div');
        text.className = 'fav-text';
        text.title = f.text;
        text.innerText = f.text;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'favorite-toggle';
        removeBtn.innerText = '✖';
        removeBtn.title = 'Remove favorite';
        removeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(f.id, f.text, f.sender); });
        item.appendChild(text);
        item.appendChild(removeBtn);
        item.addEventListener('click', () => {
            // scroll to message if present
            const target = document.querySelector(`[data-msg-id="${f.id}"]`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const m = target.querySelector('.message');
                if (m) {
                    m.classList.add('favorited');
                    setTimeout(() => m.classList.remove('favorited'), 1200);
                }
            } else {
                // try to find by text match
                const nodes = Array.from(document.querySelectorAll('.message'));
                const match = nodes.find(n => n.innerText && n.innerText.trim().startsWith(f.text.substring(0, 20)));
                if (match) match.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        list.appendChild(item);
    });
}

/* Session Insights helpers */
// (Session Insights removed) 

/**
 * Enable or disable message animations globally
 */
function toggleAnimations(enabled) {
    document.body.classList.toggle('no-animations', !enabled);
    localStorage.setItem('animations', enabled ? 'on' : 'off');
}

/**
 * Open settings panel
 */
function openSettings() {
    settingsPanel.classList.add('open');
}

/**
 * Close settings panel
 */
function closeSettingsPanel() {
    settingsPanel.classList.remove('open');
}

// ============ ACCESSIBILITY & UX IMPROVEMENTS ============

/**
 * Allow textarea-like behavior for multi-line input
 */
function setupAutoExpandingTextarea(inputElement) {
    inputElement.addEventListener('input', () => {
        inputElement.style.height = 'auto';
        const newHeight = Math.min(inputElement.scrollHeight, 120);
        inputElement.style.height = newHeight + 'px';
    });
}

// Setup auto-expanding for both inputs
setupAutoExpandingTextarea(searchInput);
setupAutoExpandingTextarea(searchInputBottom);

/**
 * Focus primary input on load
 */
window.addEventListener('load', () => {
    searchInput.focus();
});

// ============ UTILITY FUNCTIONS ============

/**
 * Debounce function for performance
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format timestamp for messages
 */
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============ EXPERIMENTAL: API INTEGRATION PLACEHOLDER ============

/**
 * Send message to actual API (replace with your backend)
 */
async function sendToAPI(message, imageData = null) {
    try {
        const payload = {
            message: message,
            image: imageData,
            conversationHistory: conversationHistory
        };

        // Replace with your actual API endpoint
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusCode}`);
        }

        const data = await response.json();
        return data.reply;

    } catch (error) {
        console.error('API Error:', error);
        return 'Sorry, I encountered an error. Please try again.';
    }
}

// Ready to use! 🚀
console.log('Chat Application Initialized');

