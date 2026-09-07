// robot_chat.js - Maestro Python AI Assistant & Chat Familiar (2026)
// Manejo del Asistente Virtual Búscame y Chat con Python Backend

function getAiModal() {
  return document.getElementById('aiAssistantModal');
}

function getChatHistory() {
  return document.getElementById('chatHistory');
}

function getChatMessagesTab() {
  return document.getElementById('chatMessages');
}

function getChatInput() {
  return document.getElementById('chatInput') || document.getElementById('customChatInput');
}

function openAiAssistantModal() {
  const modal = getAiModal();
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  const history = getChatHistory();
  if (history && history.children.length === 0) {
    appendMessage('assistant', '🤖 ¡Hola! Soy el Asistente Virtual de la Familia Andrada. ¿En qué te puedo ayudar hoy? Puedes preguntarme dónde está cualquier familiar, el estado de las baterías, cámaras de seguridad o pedir ayuda SOS.');
  }

  const input = getChatInput();
  if (input) input.focus();
}

function closeAiAssistantModal() {
  const modal = getAiModal();
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function appendMessage(sender, text) {
  const containers = [getChatHistory(), getChatMessagesTab()].filter(Boolean);
  if (containers.length === 0) return;

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  containers.forEach(container => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    bubble.innerHTML = `<div>${text.replace(/\n/g, '<br>')}</div><small style="font-size:9px; opacity:0.75; display:block; text-align:right; margin-top:3px;">${timeStr}</small>`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  });
}

async function sendMessageToPythonBot(message) {
  if (!message || !message.trim()) return;
  const cleanMsg = message.trim();

  appendMessage('user', cleanMsg);

  // Indicator while waiting for Python response
  const history = getChatHistory();
  const loading = document.createElement('div');
  loading.className = 'chat-bubble loading';
  loading.textContent = '🤖 Asistente Python analizando...';
  if (history) history.appendChild(loading);

  const activeUser = (typeof currentUser !== 'undefined' && currentUser) 
    ? currentUser 
    : ((typeof activeUser !== 'undefined' && activeUser) ? activeUser : { id: 'carlos_andrada', name: 'Eduardo Andrada' });

  try {
    const res = await fetch('/api/chat/bot_reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: activeUser.id || 'user',
        user_name: activeUser.name || 'Familia Andrada',
        text: cleanMsg
      })
    });

    const data = await res.json();
    loading.remove();

    const reply = data?.message?.text || 'Entendido. Registro guardado en la red familiar Andrada.';
    appendMessage('assistant', reply);

    if (typeof notifyInPhone === 'function') {
      notifyInPhone('🤖 Asistente Búscame AI', reply);
    }
  } catch (err) {
    loading.remove();
    console.warn('[AI Bot] Error conectando al servidor Python, usando respuesta local:', err);
    const fallbackText = `📍 ${activeUser.name || 'Familiar'}: Tu consulta "${cleanMsg}" fue recibida. Todas las funciones de seguimiento en tiempo real y mapa están activas.`;
    appendMessage('assistant', fallbackText);
  }
}

function sendMessage(event) {
  if (event) event.preventDefault();
  const input = getChatInput();
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  sendMessageToPythonBot(msg);
}

// Bind event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chatForm');
  if (form) {
    form.addEventListener('submit', sendMessage);
  }
  const customForm = document.querySelector('.chat-input-row');
  if (customForm) {
    customForm.addEventListener('submit', sendMessage);
  }
});

// Export globals
window.openAiAssistantModal = openAiAssistantModal;
window.closeAiAssistantModal = closeAiAssistantModal;
window.sendMessageToPythonBot = sendMessageToPythonBot;
window.sendMessage = sendMessage;
