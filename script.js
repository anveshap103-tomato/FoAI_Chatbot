/* ========================================
   YOUR BOT — AI Chatbot Logic
   OpenRouter Chat + Hugging Face Image Gen
   ======================================== */

// ─── API Configuration ──────────────────────────────────────────
const HF_CHAT_URL = "https://router.huggingface.co/featherless-ai/v1/chat/completions";
const HF_IMAGE_URL = "https://router.huggingface.co/nscale/v1/images/generations";

// ─── DOM Elements ───────────────────────────────────────────────
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const generateImageBtn = document.getElementById("generateImageBtn");
const typingIndicator = document.getElementById("typingIndicator");
const welcomeScreen = document.getElementById("welcomeScreen");
const clearChatBtn = document.getElementById("clearChatBtn");
const settingsBtn = document.getElementById("settingsBtn");

// Modal elements
const apiKeyModal = document.getElementById("apiKeyModal");
const hfKeyInput = document.getElementById("hfKeyInput");
const saveKeysBtn = document.getElementById("saveKeysBtn");
const modalError = document.getElementById("modalError");
const appContainer = document.querySelector(".app-container");

// ─── State ──────────────────────────────────────────────────────
let conversationHistory = [];
let isProcessing = false;

// ─── Helpers: localStorage Keys ─────────────────────────────────
function getHuggingFaceKey() {
    return localStorage.getItem("hf_api_key") || "";
}

function hasValidKeys() {
    return getHuggingFaceKey().length > 0;
}

// ─── Modal Logic ────────────────────────────────────────────────
function showModal() {
    apiKeyModal.classList.remove("hidden");
    appContainer.classList.add("locked");
    modalError.textContent = "";
    hfKeyInput.value = getHuggingFaceKey();
    setTimeout(() => hfKeyInput.focus(), 100);
}

function hideModal() {
    apiKeyModal.classList.add("hidden");
    appContainer.classList.remove("locked");
}

function handleSaveKeys() {
    const hfKey = hfKeyInput.value.trim();

    if (!hfKey) {
        showModalError("Please enter your Hugging Face API key.");
        hfKeyInput.focus();
        return;
    }

    localStorage.setItem("hf_api_key", hfKey);
    hideModal();
    updateUIState();
}

function showModalError(msg) {
    modalError.textContent = msg;
}

// ─── Toggle Password Visibility ─────────────────────────────────
function initToggleButtons() {
    document.querySelectorAll(".toggle-visibility-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            if (input) {
                input.type = input.type === "password" ? "text" : "password";
            }
        });
    });
}

// ─── UI State: enable/disable chat based on keys ────────────────
function updateUIState() {
    const keysPresent = hasValidKeys();
    sendBtn.disabled = !keysPresent;
    generateImageBtn.disabled = !keysPresent;
    messageInput.disabled = !keysPresent;

    if (keysPresent) {
        messageInput.setAttribute("placeholder", "Type a message...");
    } else {
        messageInput.setAttribute("placeholder", "Enter API keys to start chatting...");
    }
}

// ─── Initialization ─────────────────────────────────────────────
function init() {
    // Show modal if keys are missing
    if (!hasValidKeys()) {
        showModal();
    } else {
        hideModal();
    }
    updateUIState();

    // Event listeners
    sendBtn.addEventListener("click", handleSendMessage);
    generateImageBtn.addEventListener("click", handleGenerateImage);
    clearChatBtn.addEventListener("click", clearChat);
    settingsBtn.addEventListener("click", showModal);
    saveKeysBtn.addEventListener("click", handleSaveKeys);

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Allow Enter to submit modal
    hfKeyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSaveKeys();
    });

    // Auto-resize textarea
    messageInput.addEventListener("input", () => {
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
    });

    // Quick action buttons
    document.querySelectorAll(".quick-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (!hasValidKeys()) {
                showModal();
                return;
            }
            const prompt = btn.getAttribute("data-prompt");
            messageInput.value = prompt;
            handleSendMessage();
        });
    });

    initToggleButtons();
}

// ─── Send Message Handler ───────────────────────────────────────
async function handleSendMessage() {
    const text = messageInput.value.trim();
    if (!text || isProcessing) return;

    if (!hasValidKeys()) {
        showModal();
        return;
    }

    hideWelcomeScreen();
    addMessage(text, "user");
    conversationHistory.push({ role: "user", content: text });

    messageInput.value = "";
    messageInput.style.height = "auto";
    setProcessing(true);
    showTypingIndicator();

    try {
        const reply = await fetchChatResponse(conversationHistory);
        hideTypingIndicator();
        addMessage(reply, "bot");
        conversationHistory.push({ role: "assistant", content: reply });
    } catch (err) {
        hideTypingIndicator();
        const errMsg = err.message || "Something went wrong. Please try again.";
        if (errMsg.includes("401") || errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("invalid")) {
            addMessage(`⚠️ Invalid Hugging Face API key. Please check your key in settings.`, "bot", false, true);
        } else {
            addMessage(`⚠️ ${errMsg}`, "bot", false, true);
        }
    } finally {
        setProcessing(false);
    }
}

// ─── Generate Image Handler ─────────────────────────────────────
async function handleGenerateImage() {
    const prompt = messageInput.value.trim();
    if (!prompt || isProcessing) {
        if (!prompt) {
            messageInput.focus();
            messageInput.setAttribute("placeholder", "Describe the image you want to generate...");
            setTimeout(() => messageInput.setAttribute("placeholder", "Type a message..."), 3000);
        }
        return;
    }

    if (!hasValidKeys()) {
        showModal();
        return;
    }

    hideWelcomeScreen();
    addMessage(`🎨 Generate image: "${prompt}"`, "user");
    messageInput.value = "";
    messageInput.style.height = "auto";
    setProcessing(true);
    showTypingIndicator();

    try {
        const imageUrl = await fetchGeneratedImage(prompt);
        hideTypingIndicator();
        addMessage(imageUrl, "bot", true);
    } catch (err) {
        hideTypingIndicator();
        const errMsg = err.message || "Failed to generate image. Please try again.";
        if (errMsg.includes("401") || errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("invalid")) {
            addMessage(`⚠️ Invalid Hugging Face API key. Please check your key in settings.`, "bot", false, true);
        } else {
            addMessage(`⚠️ ${errMsg}`, "bot", false, true);
        }
    } finally {
        setProcessing(false);
    }
}

// ─── API: Chat Completion ────────────────────────────────────────
async function fetchChatResponse(messages) {
    const apiKey = getHuggingFaceKey();
    const response = await fetch(HF_CHAT_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "Qwen/Qwen2.5-1.5B-Instruct",
            messages,
            max_tokens: 1024,
        }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `API error (${response.status})`);
    return data.choices?.[0]?.message?.content || "I didn't get a response. Try again.";
}

// ─── API: Image Generation ───────────────────────────────────────
async function fetchGeneratedImage(prompt) {
    const apiKey = getHuggingFaceKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
        const response = await fetch(HF_IMAGE_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "stabilityai/stable-diffusion-xl-base-1.0",
                prompt,
                response_format: "url",
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = `Image API error (${response.status})`;
            try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
            throw new Error(errMsg);
        }

        const data = await response.json();
        const url = data?.data?.[0]?.url;
        if (url) return url;

        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image returned. Please try again.");
        const byteChars = atob(b64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        return URL.createObjectURL(new Blob([byteArr], { type: "image/png" }));
    } catch (err) {
        if (err.name === "AbortError") throw new Error("Image generation timed out. Please try again.");
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

// ─── UI: Add Message ────────────────────────────────────────────
function addMessage(content, sender, isImage = false, isError = false) {
    const row = document.createElement("div");
    row.className = `message-row ${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.innerHTML = sender === "bot"
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
             <circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/>
             <path d="M9 17h6" stroke-linecap="round"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
             <circle cx="12" cy="7" r="4"/>
           </svg>`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (isImage) {
        const label = document.createElement("div");
        label.className = "image-label";
        label.textContent = "🖼️ Generated Image";
        bubble.appendChild(label);

        const img = document.createElement("img");
        img.src = content;
        img.alt = "AI Generated Image";
        img.loading = "lazy";
        bubble.appendChild(img);
    } else {
        const textEl = document.createElement("div");
        textEl.className = isError ? "error-text" : "";
        textEl.textContent = content;
        bubble.appendChild(textEl);
    }

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = getFormattedTime();
    bubble.appendChild(time);

    row.appendChild(avatar);
    row.appendChild(bubble);

    // Insert before typing indicator
    chatMessages.insertBefore(row, typingIndicator);
    scrollToBottom();
}

// ─── UI: Typing Indicator ───────────────────────────────────────
function showTypingIndicator() {
    typingIndicator.classList.add("visible");
    scrollToBottom();
}

function hideTypingIndicator() {
    typingIndicator.classList.remove("visible");
}

// ─── UI: Welcome Screen ────────────────────────────────────────
function hideWelcomeScreen() {
    if (welcomeScreen) {
        welcomeScreen.style.display = "none";
    }
}

// ─── UI: Clear Chat ─────────────────────────────────────────────
function clearChat() {
    conversationHistory = [];
    const messages = chatMessages.querySelectorAll(".message-row");
    messages.forEach((msg) => msg.remove());
    if (welcomeScreen) {
        welcomeScreen.style.display = "";
    }
}

// ─── UI: Processing State ───────────────────────────────────────
function setProcessing(state) {
    isProcessing = state;
    sendBtn.disabled = state;
    generateImageBtn.disabled = state;
    messageInput.disabled = state;
    if (!state) messageInput.focus();
}

// ─── Utilities ──────────────────────────────────────────────────
function scrollToBottom() {
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Start ──────────────────────────────────────────────────────
init();
