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
  if (typeof switchTab === 'function') {
    switchTab('tab-pickup');
  }
  const input = getChatInput();
  if (input) input.focus();
}

function closeAiAssistantModal() {
  // Modal desestimado; chat unificado en la pestaña Búscame
}

function selectUberDest(destName) {
  const input = document.getElementById('uberDestInput');
  if (input) input.value = destName;
}

function triggerUberRequest(customDestName = '') {
  const user = (typeof activeUser !== 'undefined' && activeUser) 
    ? activeUser 
    : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser : { name: 'Familiar', lat: -28.46957, lng: -65.78524 });
    
  const lat = user.lat || -28.46957;
  const lng = user.lng || -65.78524;

  let destName = customDestName;
  if (!destName) {
    const input = document.getElementById('uberDestInput');
    destName = input ? input.value.trim() : '';
  }
  if (!destName) destName = 'Casa Andrada';

  let destLat = -28.46957;
  let destLng = -65.78524;
  if (destName.toLowerCase().includes('unca') || destName.toLowerCase().includes('facultad') || destName.toLowerCase().includes('trabajo')) {
    destLat = -28.45940;
    destLng = -65.78910;
  } else if (destName.toLowerCase().includes('colegio') || destName.toLowerCase().includes('escuela')) {
    destLat = -28.46320;
    destLng = -65.78110;
  }

  const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${lat.toFixed(6)}&pickup[longitude]=${lng.toFixed(6)}&dropoff[latitude]=${destLat.toFixed(6)}&dropoff[longitude]=${destLng.toFixed(6)}&dropoff[nickname]=${encodeURIComponent(destName)}`;

  window.open(uberUrl, '_blank');

  sendMessageToPythonBot(`🚖 Solicitando Uber/Taxi hacia "${destName}" desde posición GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}). Ver posición: ${mapsUrl}`);
}

function sendPhoneQuickShare() {
  const user = (typeof activeUser !== 'undefined' && activeUser) 
    ? activeUser 
    : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser : { name: 'Familiar', phone: '+54 9 383 412-3456' });
  const phone = user.phone || '+54 9 383 412-3456';
  sendMessageToPythonBot(`📞 Mi número de teléfono de contacto es: ${phone}`);
}

function sendLocationQuickShare() {
  const user = (typeof activeUser !== 'undefined' && activeUser) 
    ? activeUser 
    : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser : { name: 'Familiar', lat: -28.46957, lng: -65.78524, battery: 90 });
  const lat = (user.lat || -28.46957).toFixed(6);
  const lng = (user.lng || -65.78524).toFixed(6);
  const batt = user.battery || 90;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  sendMessageToPythonBot(`📍 Compartiendo mi ubicación actual en vivo: ${mapsUrl} (Batería: ${batt}%)`);
}

function broadcastSystemAlertToChat(title, detail, type = 'warning', member = null) {
  const u = member || ((typeof activeUser !== 'undefined' && activeUser) ? activeUser : { name: 'Familiar', role: 'Usuario', lat: -28.46957, lng: -65.78524, battery: 90 });
  const mapsUrl = `https://www.google.com/maps?q=${(u.lat||-28.46957).toFixed(6)},${(u.lng||-65.78524).toFixed(6)}`;
  sendMessageToPythonBot(`🚨 [ALERTA SISTEMA] ${title} - ${u.name}: ${detail}. Ver posición: ${mapsUrl}`);
}

appendChatMessage = function(type, text, senderName = '', timestamp = '') {
  const container = getChatMessagesTab();
  if (!container) return;

  const now = new Date();
  const timeStr = timestamp || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  let typeClass = 'msg-incoming';
  let bubbleClass = 'assistant';
  if (type === 'outgoing' || type === 'user') {
    typeClass = 'msg-outgoing';
    bubbleClass = 'user';
  } else if (type === 'system') {
    typeClass = 'msg-system';
    bubbleClass = 'system';
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${typeClass} chat-bubble ${bubbleClass}`;
  
  let senderHeader = '';
  if (senderName && typeClass === 'msg-incoming') {
    senderHeader = `<small style="font-size:10px; font-weight:800; color:#38BDF8; display:block; margin-bottom:2px;">${senderName}</small>`;
  }

  // Formatear enlaces de Google Maps y alertas si existen en el texto
  let formattedText = text.replace(/(https:\/\/www\.google\.com\/maps\?q=[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#34D399; font-weight:800; text-decoration:underline;">🗺️ Ver en Mapa</a>');
  formattedText = formattedText.replace(/(https:\/\/m\.uber\.com\/ul\?=[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#F59E0B; font-weight:800; text-decoration:underline;">🚖 Abrir Uber App</a>');

  msgDiv.innerHTML = `${senderHeader}<div>${formattedText.replace(/\n/g, '<br>')}</div><span class="msg-time">${timeStr}</span>`;
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
};

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
window.selectUberDest = selectUberDest;
window.triggerUberRequest = triggerUberRequest;
window.sendPhoneQuickShare = sendPhoneQuickShare;
window.sendLocationQuickShare = sendLocationQuickShare;
window.broadcastSystemAlertToChat = broadcastSystemAlertToChat;

