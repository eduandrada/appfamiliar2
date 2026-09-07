// ==============================================================================
// FAMILIA ANDRADA - SISTEMA DE CHAT EN TIEMPO REAL Y ASISTENTE IA (2026)
// ==============================================================================

let renderedMessageIds = new Set();
let chatSyncTimer = null;

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
    appendChatMessage('incoming', '🤖 <strong>Asistente Búscame AI:</strong> ¡Hola! Soy el Asistente de la Familia Andrada. Puedes preguntarme dónde está cualquier familiar, nivel de baterías, estado de las cámaras o solicitar auxilio SOS.');
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

function appendChatMessage(type, text, senderName = '', timestamp = '') {
  const containers = [getChatHistory(), getChatMessagesTab()].filter(Boolean);
  if (containers.length === 0) return;

  const now = new Date();
  const timeStr = timestamp || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Map type to valid CSS classes
  let typeClass = 'msg-incoming';
  let bubbleClass = 'assistant';
  if (type === 'outgoing' || type === 'user') {
    typeClass = 'msg-outgoing';
    bubbleClass = 'user';
  } else if (type === 'system') {
    typeClass = 'msg-system';
    bubbleClass = 'system';
  }

  containers.forEach(container => {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${typeClass} chat-bubble ${bubbleClass}`;
    
    let senderHeader = '';
    if (senderName && typeClass === 'msg-incoming') {
      senderHeader = `<small style="font-size:10px; font-weight:800; color:#38BDF8; display:block; margin-bottom:2px;">${senderName}</small>`;
    }
    
    msgDiv.innerHTML = `${senderHeader}<div>${text.replace(/\n/g, '<br>')}</div><span class="msg-time">${timeStr}</span>`;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
  });
}

async function sendMessageToPythonBot(messageText) {
  if (!messageText || !messageText.trim()) return;
  const cleanMsg = messageText.trim();

  const user = (typeof activeUser !== 'undefined' && activeUser) 
    ? activeUser 
    : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser : { id: 'carlos_andrada', name: 'Eduardo Andrada' });

  // 1. Renderizar localmente en pantalla de inmediato
  appendChatMessage('outgoing', cleanMsg, user.name);

  // 2. Guardar mensaje en backend Python
  try {
    const sendRes = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: user.id || 'user',
        sender_name: user.name || 'Familia Andrada',
        text: cleanMsg
      })
    });
    if (sendRes.ok) {
      const sendData = await sendRes.json();
      if (sendData.message && sendData.message.id) {
        renderedMessageIds.add(sendData.message.id);
      }
    }
  } catch (e) {
    console.warn('[Chat] Servidor offline enviando mensaje:', e);
  }

  // 3. Consultar al Bot de Inteligencia IA en Python
  try {
    const botRes = await fetch('/api/chat/bot_reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id || 'user',
        user_name: user.name || 'Familia Andrada',
        text: cleanMsg
      })
    });

    if (botRes.ok) {
      const data = await botRes.json();
      const replyText = data?.reply || data?.message?.text || 'Entendido. Registro guardado en la red familiar Andrada.';
      appendChatMessage('incoming', replyText, '🤖 Asistente Búscame AI');

      if (typeof notifyInPhone === 'function') {
        notifyInPhone('🤖 Asistente Búscame AI', replyText);
      }
    }
  } catch (err) {
    console.warn('[Chat] Fallback respuesta local:', err);
    const fallbackText = `📍 ${user.name}: Tu mensaje "${cleanMsg}" fue registrado. El canal de comunicación familiar está activo.`;
    appendChatMessage('incoming', fallbackText, '🤖 Sistema Familia');
  }
}

async function syncChatMessagesWithBackend() {
  try {
    const res = await fetch('/api/chat/messages?limit=50');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        const currentUser = (typeof activeUser !== 'undefined' && activeUser) ? activeUser : null;
        
        data.messages.forEach(msg => {
          if (!renderedMessageIds.has(msg.id)) {
            renderedMessageIds.add(msg.id);
            const isMine = currentUser && (currentUser.id === msg.sender_id);
            const type = isMine ? 'outgoing' : 'incoming';
            appendChatMessage(type, msg.text, msg.sender_name, msg.timestamp);
          }
        });
      }
    }
  } catch (e) {
    // Silencioso en caso de estar offline
  }
}

function startChatSyncLoop() {
  syncChatMessagesWithBackend();
  if (chatSyncTimer) clearInterval(chatSyncTimer);
  chatSyncTimer = setInterval(syncChatMessagesWithBackend, 3000);
}

function handleSendMessage(event) {
  if (event) event.preventDefault();
  const input = getChatInput();
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  sendMessageToPythonBot(msg);
}

// Inicialización de Listeners al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chatForm');
  if (form) form.addEventListener('submit', handleSendMessage);

  const customForm = document.querySelector('.chat-input-row');
  if (customForm) customForm.addEventListener('submit', handleSendMessage);

  startChatSyncLoop();
});

// Exportar funciones globales
window.openAiAssistantModal = openAiAssistantModal;
window.closeAiAssistantModal = closeAiAssistantModal;
window.sendMessageToPythonBot = sendMessageToPythonBot;
window.sendMessage = handleSendMessage;
window.handleSendCustomMessage = handleSendMessage;
window.sendQuickReply = function(text) { sendMessageToPythonBot(text); };
window.sendQuickCheckIn = function(statusText) { sendMessageToPythonBot(`📍 Check-in Rápido: ${statusText}`); };
