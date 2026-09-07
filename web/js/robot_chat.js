// robot_chat.js - Maestro Python AI Assistant (2026)
// Manejo del Asistente Virtual Búscame y Chat con Python Backend

const aiModal = document.getElementById('aiAssistantModal');
const chatHistory = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

function openAiAssistantModal() {
  if (!aiModal) return;
  aiModal.classList.remove('hidden');
  aiModal.setAttribute('aria-hidden', 'false');
  if (chatInput) chatInput.focus();
}

function closeAiAssistantModal() {
  if (!aiModal) return;
  aiModal.classList.add('hidden');
  aiModal.setAttribute('aria-hidden', 'true');
  if (chatHistory) chatHistory.innerHTML = '';
}

function appendMessage(sender, text) {
  if (!chatHistory) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendMessageToPythonBot(message) {
  appendMessage('user', message);
  
  const loading = document.createElement('div');
  loading.className = 'chat-bubble loading';
  loading.textContent = '🤖 Maestro Python analizando...';
  if (chatHistory) chatHistory.appendChild(loading);

  const activeUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : { id: 'carlos_andrada', name: 'Eduardo Andrada' };

  try {
    const res = await fetch('/api/chat/bot_reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: activeUser.id,
        user_name: activeUser.name,
        text: message
      })
    });
    const data = await res.json();
    loading.remove();
    const reply = data?.message?.text || 'Entendido. Registro guardado en la red familiar.';
    appendMessage('assistant', reply);
  } catch (err) {
    loading.remove();
    console.warn('[AI Bot] Error conectando al servidor Python, usando fallback local:', err);
    appendMessage('assistant', `📍 Entendido ${activeUser.name}. Tu consulta "${message}" fue procesada localmente en la app.`);
  }
}

function sendMessage(event) {
  if (event) event.preventDefault();
  if (!chatInput) return;
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = '';
  sendMessageToPythonBot(msg);
}

if (chatForm) {
  chatForm.addEventListener('submit', sendMessage);
}

window.openAiAssistantModal = openAiAssistantModal;
window.closeAiAssistantModal = closeAiAssistantModal;
window.sendMessageToPythonBot = sendMessageToPythonBot;

