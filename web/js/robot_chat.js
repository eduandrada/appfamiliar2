// robot_chat.js
// Handles opening/closing AI assistant modal, sending messages to Gemini API, and displaying responses.

// Retrieve DOM elements
const aiModal = document.getElementById('aiAssistantModal');
const chatHistory = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

// Open modal
function openAiAssistantModal() {
  if (!aiModal) return;
  aiModal.classList.remove('hidden');
  aiModal.setAttribute('aria-hidden', 'false');
  chatInput.focus();
}

// Close modal
function closeAiAssistantModal() {
  if (!aiModal) return;
  aiModal.classList.add('hidden');
  aiModal.setAttribute('aria-hidden', 'true');
  chatHistory.innerHTML = '';
}

// Append a message bubble to the chat history
function appendMessage(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Send user message to Gemini API and handle response
async function sendMessageToGemini(message) {
  const apiKey = window.GEMINI_API_KEY || (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
  if (!apiKey) {
    console.error('[AI] Gemini API key not set');
    alert('Clave de API de Gemini no configurada.');
    return;
  }

  appendMessage('user', message);
  // Show loading indicator
  const loading = document.createElement('div');
  loading.className = 'chat-bubble loading';
  loading.textContent = '…';
  chatHistory.appendChild(loading);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: message }] }]
      })
    });
    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
    // Remove loading
    loading.remove();
    appendMessage('assistant', reply);
    // Play feedback sound
    new Audio('audio/ding.mp3').play();
  } catch (err) {
    loading.remove();
    console.error('[AI] Error contacting Gemini:', err);
    appendMessage('assistant', 'Error al obtener respuesta.');
  }
}

// Form submit handler
function sendMessage(event) {
  event.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = '';
  sendMessageToGemini(msg);
}

// Attach event listeners if elements exist
if (chatForm) {
  chatForm.addEventListener('submit', sendMessage);
}

// Export for other modules (optional)
export { openAiAssistantModal, closeAiAssistantModal, sendMessageToGemini };
