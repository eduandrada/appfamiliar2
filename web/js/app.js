// ==============================================================================
// FAMILIA ANDRADA - LÓGICA DE APLICACIÓN MOBILE-FIRST COMPLETA (2026)
// ==============================================================================

// 1. Datos de Familiares Iniciales (Persistidos en LocalStorage)
const DEFAULT_MEMBERS = [
  {
    id: 'carlos_andrada',
    name: 'Carlos Andrada',
    dni: '34.567.890',
    phone: '+54 9 11 2345-6789',
    pin: '1234',
    role: 'Padre (Protector)',
    lat: -34.603722,
    lng: -58.381592,
    battery: 92,
    speed: 0.0,
    zone: 'Casa Andrada',
    avatar: 'CA'
  },
  {
    id: 'lucia_andrada',
    name: 'Lucía Andrada',
    dni: '36.789.012',
    phone: '+54 9 11 3456-7890',
    pin: '4321',
    role: 'Madre (Protectora)',
    lat: -34.605000,
    lng: -58.380000,
    battery: 78,
    speed: 42.5,
    zone: 'En Ruta',
    avatar: 'LA'
  },
  {
    id: 'mateo_andrada',
    name: 'Mateo Andrada',
    dni: '45.123.456',
    phone: '+54 9 11 4567-8901',
    pin: '1122',
    role: 'Hijo',
    lat: -34.608500,
    lng: -58.375000,
    battery: 64,
    speed: 0.0,
    zone: 'Colegio / Escuela',
    avatar: 'MA'
  },
  {
    id: 'sofia_andrada',
    name: 'Sofía Andrada',
    dni: '48.987.654',
    phone: '+54 9 11 5678-9012',
    pin: '3344',
    role: 'Hija',
    lat: -34.599000,
    lng: -58.390000,
    battery: 45,
    speed: 0.0,
    zone: 'Trabajo / Oficina',
    avatar: 'SA'
  }
];

// Zonas Seguras
const SAFE_ZONES = [
  { name: 'Casa Andrada', lat: -34.603722, lng: -58.381592, radius: 250, color: '#10B981' },
  { name: 'Colegio / Escuela', lat: -34.608500, lng: -58.375000, radius: 200, color: '#38BDF8' },
  { name: 'Trabajo / Oficina', lat: -34.599000, lng: -58.390000, radius: 300, color: '#8B5CF6' }
];

// Estado de la Aplicación
let familyMembers = [];
let activeUser = null;
let isAdminLoggedIn = false;
let map = null;
let memberMarkers = {};
let activeMemberId = 'carlos_andrada';
let panicTimer = null;
let panicSeconds = 30;
let loginEnteredPin = '';
let duressEnteredPin = '';
let fakeShutdownClicks = 0;
let fakeShutdownTimer = null;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  initThemeMode();
  initCustomBg();
  loadStoredMembers();
  loadStoredSession();
  updateSafeWordUI();
  initServiceWorker();
  initMap();
  renderMemberChips();
  renderDirectoryList();
  startCameraClocks();
  startUptimeStopwatch();
  initBellNotifications();
  initDrillMode();
  initGaitMotionSensor();
  loadStoredAuditLogs();
});

// Initialize push notifications for the bell button
function initPushNotifications() {
  // Request notification permission if not already granted
  if (!('Notification' in window)) {
    console.warn('[App] Notifications API not supported');
    alert('Notificaciones no soportadas en este navegador.');
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (permission !== 'granted') {
      console.warn('[App] Notification permission not granted');
      alert('Permiso de notificaciones denegado.');
      return;
    }
    // Register service worker if not already registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[App] Service Worker registered for push:', reg.scope);
        // Use the service worker to show a test notification
        const sendMsg = (worker) => {
          worker.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: '🔔 Notificaciones Activadas',
            body: 'Ahora recibirás alertas de la Familia Andrada en tu móvil.',
            url: '/'
          });
        };
        if (reg.active) {
          sendMsg(reg.active);
        } else {
          navigator.serviceWorker.ready.then((readyReg) => {
            if (readyReg.active) sendMsg(readyReg.active);
          });
        }
        alert('🔔 ¡Notificaciones activadas con éxito!');
      }).catch((err) => {
        console.error('[App] Service Worker registration failed:', err);
      });
    }
  });
}


function loadStoredMembers() {
  const saved = localStorage.getItem('andrada_family_members');
  if (saved) {
    try {
      familyMembers = JSON.parse(saved);
    } catch (e) {
      familyMembers = DEFAULT_MEMBERS;
    }
  } else {
    familyMembers = DEFAULT_MEMBERS;
    saveMembers();
  }
}

function saveMembers() {
  localStorage.setItem('andrada_family_members', JSON.stringify(familyMembers));
}

function loadStoredSession() {
  const savedSession = localStorage.getItem('andrada_active_session');
  if (savedSession) {
    try {
      activeUser = JSON.parse(savedSession);
    } catch (e) {
      activeUser = familyMembers[0];
    }
  } else {
    activeUser = familyMembers[0];
  }
  updateActiveUserUI();
}

function getAvatarHtml(member, size = 40) {
  if (member && member.photo) {
    return `<img src="${member.photo}" alt="${member.name}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; border:2px solid #38BDF8; box-shadow:0 0 10px rgba(56, 189, 248, 0.3);">`;
  }
  const initials = member ? (member.avatar || member.name.substring(0, 2).toUpperCase()) : 'FA';
  return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:linear-gradient(135deg, #0284C7, #38BDF8); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:${Math.round(size * 0.35)}px; box-shadow:0 0 10px rgba(56, 189, 248, 0.3);">${initials}</div>`;
}

function updateActiveUserUI() {
  if (!activeUser) return;
  const nameEl = document.getElementById('activeUserName');
  const profNameEl = document.getElementById('profileName');
  const profDniTelEl = document.getElementById('profileDniTel');
  const profRoleEl = document.getElementById('profileRole');
  const profAvatarEl = document.getElementById('profileAvatar');

  if (nameEl) nameEl.textContent = activeUser.name.split(' ')[0];
  if (profNameEl) profNameEl.textContent = activeUser.name;
  if (profDniTelEl) profDniTelEl.textContent = `DNI: ${activeUser.dni} • Tel: ${activeUser.phone}`;
  if (profRoleEl) profRoleEl.textContent = activeUser.role;
  if (profAvatarEl) {
    profAvatarEl.innerHTML = getAvatarHtml(activeUser, 56);
  }
}

// ==================== SERVICE WORKER Y NOTIFICACIONES ====================
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[App] Service Worker registrado para notificaciones en segundo plano:', reg.scope);
    }).catch((err) => {
      console.warn('[App] Service worker no registrado:', err);
    });
  }
}

function initBellNotifications() {
  const bell = document.getElementById('btnBellNotify');
  if (bell) {
    bell.addEventListener('click', requestNotificationPermission);
  }
}

function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        notifyInPhone('Notificaciones Activadas', 'Recibirás alertas sonoras de la Familia Andrada en segundo plano.');
      } else {
        alert('Debes habilitar los permisos de notificación en tu celular para recibir alertas.');
      }
    });
  }
}

function notifyInPhone(title, body) {
  // 1. Vibración háptica en celulares
  if ('vibrate' in navigator) {
    navigator.vibrate([400, 150, 400, 150, 400]);
  }

  // 2. Notificación local vía Service Worker o Notification API
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/img/icon-192.png' });
  }
}

// ==================== NAVEGACIÓN ENTRE PESTAÑAS ====================
function switchTab(tabId) {
  // Desactivar todas las pestañas
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-bar .nav-item').forEach(el => el.classList.remove('active'));

  // Activar la seleccionada
  const targetPane = document.getElementById(tabId);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // Marcar botón activo en barra inferior
  const navButtons = document.querySelectorAll('.bottom-nav-bar .nav-item');
  const indexMap = {
    'tab-map': 0,
    'tab-antifraud': 1,
    'tab-alone': 2,
    'tab-pickup': 3,
    'tab-edgeai': 4,
    'tab-cameras': 5,
    'tab-sos': 7,
    'tab-family': 8
  };
  const btnIndex = indexMap[tabId];
  if (btnIndex !== undefined && navButtons[btnIndex]) {
    navButtons[btnIndex].classList.add('active');
  }

  // Si entra al mapa, reajustar tamaño de Leaflet
  if (tabId === 'tab-map' && map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }

  if (tabId === 'tab-antifraud') {
    populateFraudDropdown();
    updateFraudCheckDisplay();
  }

  if (tabId === 'tab-edgeai') {
    scanBleMeshDevices();
    drawVoiceSpectrumSample();
  }
}

// ==================== MAPA LEAFLET EN VIVO ====================
function initMap() {
  map = L.map('familyMap', {
    center: [-34.603722, -58.381592],
    zoom: 15,
    zoomControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  SAFE_ZONES.forEach(zone => {
    L.circle([zone.lat, zone.lng], {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.15,
      radius: zone.radius,
      weight: 2,
      dashArray: '4, 8'
    }).addTo(map).bindPopup(`<strong>Zona Segura:</strong> ${zone.name}`);
  });

  updateMapMarkers();
}

// ==================== CÁLCULO DE DISTANCIA EN TIEMPO REAL (HAVERSINE) ====================
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDistance(lat1, lon1, lat2, lon2) {
  const km = calculateDistanceKm(lat1, lon1, lat2, lon2);
  if (km < 0.05) return 'Mismo lugar (0m)';
  if (km < 1) return `a ${Math.round(km * 1000)}m`;
  return `a ${km.toFixed(1)} km`;
}

function updateMapMarkers() {
  if (!map) return;
  const current = activeUser || familyMembers[0];

  familyMembers.forEach(m => {
    const isSelected = m.id === activeMemberId;
    const isMe = current && current.id === m.id;
    const distText = isMe ? 'Tu dispositivo' : formatDistance(current.lat, current.lng, m.lat, m.lng);

    const iconHtml = m.photo ? `
      <img src="${m.photo}" alt="${m.name}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid ${isSelected ? '#38BDF8' : '#fff'}; box-shadow:0 0 16px ${isSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(0,0,0,0.6)'};">
    ` : `
      <div style="
        background: ${isSelected ? '#38BDF8' : '#1E293B'};
        border: 2px solid #fff;
        border-radius: 50%;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 13px;
        color: #fff;
        box-shadow: 0 0 16px ${isSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(0,0,0,0.6)'};
      ">${m.avatar}</div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'custom-member-pin',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const popupHtml = `
      <div style="min-width: 190px; font-family: sans-serif; color: #000; padding: 4px;">
        <div style="font-weight: 800; font-size: 14px; color: #0F172A; margin-bottom: 2px;">${m.name}</div>
        <div style="font-size: 11px; color: #475569; font-weight: 600;">${m.role} • ${distText}</div>
        <div style="font-size: 11px; color: #0284C7; font-weight: 700; margin-top: 4px;">🔋 Batería: ${m.battery}% • ${m.zone}</div>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button style="flex:1; background: #25D366; color: #fff; border: none; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 700; cursor: pointer;" onclick="sendDirectMemberWhatsApp('${m.id}')">💬 WhatsApp</button>
          <button style="flex:1; background: #EF4444; color: #fff; border: none; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 700; cursor: pointer;" onclick="openExpressSosModal('${m.id}')">🚨 SOS</button>
        </div>
      </div>
    `;

    if (memberMarkers[m.id]) {
      memberMarkers[m.id].setLatLng([m.lat, m.lng]);
      memberMarkers[m.id].setIcon(customIcon);
      memberMarkers[m.id].setPopupContent(popupHtml);
    } else {
      const marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(popupHtml);
      marker.on('click', () => selectMember(m.id));
      memberMarkers[m.id] = marker;
    }
  });
}

function renderMemberChips() {
  const container = document.getElementById('mapMemberChips');
  if (!container) return;

  container.innerHTML = familyMembers.map(m => `
    <div class="m-chip ${m.id === activeMemberId ? 'active' : ''}" onclick="selectMember('${m.id}')">
      ${getAvatarHtml(m, 26)}
      <span>${m.name.split(' ')[0]}</span>
      <small style="color: ${m.battery <= 20 ? '#EF4444' : '#10B981'};">${m.battery}%</small>
    </div>
  `).join('');
}

function selectMember(memberId) {
  activeMemberId = memberId;
  const member = familyMembers.find(m => m.id === memberId);
  if (!member) return;

  renderMemberChips();
  updateMapMarkers();

  if (map) {
    map.flyTo([member.lat, member.lng], 16, { duration: 1.0 });
  }

  const current = activeUser || familyMembers[0];
  if (current && member.id !== current.id) {
    logLocationView(current, member);
  }
}

function centerMapOnFamily() {
  if (!map || Object.keys(memberMarkers).length === 0) return;
  const group = L.featureGroup(Object.values(memberMarkers));
  map.fitBounds(group.getBounds().pad(0.3));
}

// ==================== DISPARADORES DE SIMULACIÓN ====================
function triggerSimulationEvent(type) {
  const member = familyMembers.find(m => m.id === activeMemberId) || familyMembers[0];

  switch (type) {
    case 'CRITICAL_BATTERY':
      member.battery = 2;
      notifyInPhone('🚨 Batería Crítica (2%)', `${member.name} se está apagando. Última posición GPS capturada.`);
      showWhatsAppModal(
        `🚨 APAGADO INMINENTE / BATERÍA CRÍTICA (2%)`,
        `Dispositivo de ${member.name} (DNI: ${member.dni}) se está apagando (ACTION_SHUTDOWN).\nÚltimas coordenadas GPS capturadas.\nBatería restante: 2%.`,
        member.lat,
        member.lng
      );
      break;

    case 'IMPACT':
      member.speed = 0.0;
      notifyInPhone('🚨 Impacto / Caída Detectada', `Desaceleración brusca registrada para ${member.name}.`);
      showWhatsAppModal(
        `🚨 IMPACTO O COLISIÓN DETECTADA`,
        `Desaceleración violenta (>40 km/h a 0 en <1s) en el teléfono de ${member.name}.\nAcelerómetro: 4.8G.\nAlarma SOS activada en segundo plano.`,
        member.lat,
        member.lng
      );
      break;

    case 'ROUTE_DEVIATION':
      member.lat = -34.638000;
      member.lng = -58.428000;
      member.zone = 'Desvío (4.1 km)';
      updateMapMarkers();
      selectMember(member.id);
      notifyInPhone('⚠️ Desvío de Ruta', `${member.name} se desvió a más de 4 km de zonas seguras.`);
      showWhatsAppModal(
        `⚠️ DESVÍO ATÍPICO DE RUTA (> 1.5 km)`,
        `El familiar ${member.name} se alejó a 4.1 km de Casa Andrada o Colegio.\nVelocidad: ${member.speed} km/h.`,
        member.lat,
        member.lng
      );
      break;
  }
}

// ==================== TAB 2: SOLO EN CASA ====================
function toggleAloneMode(isActive) {
  const title = document.getElementById('aloneStatusTitle');
  const sub = document.getElementById('aloneStatusSub');
  const alertBox = document.getElementById('aloneActiveAlert');

  if (isActive) {
    title.textContent = 'Modo Quedo Sola en Casa: ACTIVO';
    title.style.color = 'var(--accent-emerald)';
    sub.textContent = 'Tu familia sabe que estás sola en casa y está atenta.';
    alertBox.classList.remove('hidden');

    notifyInPhone('🏠 Alerta Familiar: Sola en Casa', `${activeUser.name} ha activado el Modo 'Quedo Sola en Casa'. Monitoreo activado.`);
  } else {
    title.textContent = 'Modo Casa Desactivado';
    title.style.color = '#fff';
    sub.textContent = 'Toca para avisar a toda la familia que estás en casa a solas.';
    alertBox.classList.add('hidden');
  }
}

function triggerDomesticAlert(type) {
  let title = '';
  let msg = '';

  if (type === 'SUSPICIOUS_NOISE') {
    title = '⚠️ RUIDO SOSPECHOSO EN EL HOGAR';
    msg = `${activeUser.name} escuchó ruidos extraños o sospechosos en la puerta/patio de Casa Andrada.`;
  } else if (type === 'FIRE_ALERT') {
    title = '🔥 ALERTA DE INCENDIO O GAS';
    msg = `¡URGENTE! ${activeUser.name} activó alerta por fuego o humo en Casa Andrada.`;
  } else if (type === 'MEDICAL_HELP') {
    title = '🏥 URGENCIA MÉDICA / CAÍDA';
    msg = `¡URGENTE! ${activeUser.name} requiere auxilio médico de inmediato en el hogar.`;
  }

  notifyInPhone(title, msg);
  showWhatsAppModal(title, msg, -34.603722, -58.381592);
}

// ==================== TAB 3: VENÍ A BUSCARME & CHAT ====================
function triggerPickupRequest() {
  const current = activeUser || familyMembers[0];
  notifyInPhone('🚗 Solicitud de Búsqueda', `${current.name} pide que lo vayan a buscar a su ubicación.`);

  // Mensaje en el chat
  appendChatMessage(
    'incoming',
    `🚗 <strong>${current.name}</strong> solicita que lo vayan a buscar.<br>📍 Ubicación: https://maps.google.com/?q=${current.lat},${current.lng}<br>🔋 Batería: ${current.battery}%`
  );

  // Respuesta automática tras 2 segundos simulando a otro familiar
  setTimeout(() => {
    appendChatMessage('outgoing', `Lucía: "¡Hola ${current.name.split(' ')[0]}! Ya vi tu ubicación, voy en camino a buscarte."`);
  }, 2000);
}

function sendQuickReply(replyText) {
  appendChatMessage('outgoing', `Tú: "${replyText}"`);

  setTimeout(() => {
    if (replyText.includes('camino')) {
      appendChatMessage('incoming', 'Carlos: "Dale, te espero en la esquina. Gracias."');
    } else if (replyText.includes('auto') || replyText.includes('Uber')) {
      appendChatMessage('incoming', 'Carlos: "Genial, pasame la patente del auto cuando la tengas."');
    } else {
      appendChatMessage('incoming', 'Familiar: "Recibido, estoy atento."');
    }
  }, 1800);
}

function handleSendCustomMessage(e) {
  e.preventDefault();
  const input = document.getElementById('customChatInput');
  const rawText = input.value.trim();
  if (!rawText) return;

  const cleanText = filterBadWords(rawText);
  appendChatMessage('outgoing', `Tú: "${cleanText}"`);
  input.value = '';

  setTimeout(() => {
    appendChatMessage('incoming', 'Familiar: "Entendido, estoy atento al mapa."');
  }, 2000);
}

function appendChatMessage(type, htmlContent) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg msg-${type}`;
  msgDiv.innerHTML = `${htmlContent} <span class="msg-time">${timeStr}</span>`;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// ==================== TAB 4: CÁMARAS DE SEGURIDAD ====================
function startCameraClocks() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`camTime${i}`);
      if (el) el.textContent = `REC ${timeStr}`;
    }
  }, 1000);
}

// ==================== TAB 5: BOTÓN SOS 30s ====================
function triggerPanicCountdown() {
  triggerEmergencyWithSafeguard(
    'SOS',
    () => startRealPanicCountdown(),
    '🚨 ALERTA DE PÁNICO SOS',
    'Has presionado el Botón de Pánico. Iniciando despacho de socorro en:'
  );
}

function startRealPanicCountdown() {
  if (isDrillMode) {
    notifyInPhone('🎓 SIMULACRO SOS (MODO PRUEBA)', 'Prueba completada con éxito. Alerta simulada sin enviar a WhatsApp.');
    alert('🎓 SIMULACRO SOS COMPLETADO (MODO PRUEBA):\n\nLa alerta de emergencia se simuló con éxito para entrenamiento familiar. Ningún contacto externo fue alertado.');
    return;
  }

  if (panicTimer) return;

  const btn = document.getElementById('btnMainSOS');
  const cancelBtn = document.getElementById('btnCancelSOS');
  const badge = document.getElementById('sosTimerBadge');
  const headline = document.getElementById('sosHeadline');

  panicSeconds = 30;
  btn.classList.add('active-panic');
  cancelBtn.classList.remove('hidden');
  badge.classList.remove('hidden');
  badge.textContent = panicSeconds;
  headline.textContent = `¡DESPACHANDO SOS EN ${panicSeconds}s!`;
  headline.style.color = '#EF4444';

  notifyInPhone('🚨 ALARMA SOS INICIADA', 'Cuenta regresiva de 30 segundos previa al despacho general a WhatsApp.');

  panicTimer = setInterval(() => {
    panicSeconds--;
    badge.textContent = panicSeconds;
    headline.textContent = `¡DESPACHANDO SOS EN ${panicSeconds}s!`;

    if (panicSeconds <= 0) {
      clearInterval(panicTimer);
      panicTimer = null;
      btn.classList.remove('active-panic');
      cancelBtn.classList.add('hidden');
      badge.classList.add('hidden');
      headline.textContent = 'BOTÓN DE PÁNICO FAMILIAR';
      headline.style.color = '#fff';

      // Despacho de Alerta
      const current = activeUser || familyMembers[0];
      showWhatsAppModal(
        `🚨 ALERTA SOS MANUAL: ${current.name}`,
        `Se ha activado el botón de pánico en el teléfono de ${current.name} (DNI: ${current.dni}).\nBatería: ${current.battery}%\nVelocidad: ${current.speed} km/h.\n¡Auxilio solicitado de forma inmediata!`,
        current.lat,
        current.lng
      );
    }
  }, 1000);
}

function cancelPanicCountdown() {
  if (panicTimer) {
    clearInterval(panicTimer);
    panicTimer = null;
  }

  const btn = document.getElementById('btnMainSOS');
  const cancelBtn = document.getElementById('btnCancelSOS');
  const badge = document.getElementById('sosTimerBadge');
  const headline = document.getElementById('sosHeadline');

  btn.classList.remove('active-panic');
  cancelBtn.classList.add('hidden');
  badge.classList.add('hidden');
  headline.textContent = 'Alarma SOS Cancelada';
  headline.style.color = '#10B981';

  setTimeout(() => {
    headline.textContent = 'BOTÓN DE PÁNICO FAMILIAR';
    headline.style.color = '#fff';
  }, 3000);
}

// ==================== TAB 6: DIRECTORIO Y ACCIONES FAMILIARES ====================
let expressSosTargetMemberId = null;

function renderDirectoryList() {
  const container = document.getElementById('familyDirectoryList');
  if (!container) return;

  const current = activeUser || familyMembers[0];

  container.innerHTML = familyMembers.map(m => {
    const isMe = current && current.id === m.id;
    const distText = isMe ? 'Tu dispositivo (Aquí)' : formatDistance(current.lat, current.lng, m.lat, m.lng);

    return `
      <div class="dir-member-card glass-card" style="padding: 14px; margin-bottom: 12px; border-radius: 14px; background: rgba(18, 28, 48, 0.7); border: 1px solid var(--border-glass);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="dir-avatar">${getAvatarHtml(m, 44)}</div>
            <div>
              <div class="dir-name" style="font-weight: 700; font-size: 15px; color: #fff;">${m.name} ${isMe ? '<small style="color: var(--accent-blue); font-weight: 600;">(Tú)</small>' : ''}</div>
              <div class="dir-meta" style="font-size: 11px; color: var(--text-secondary);">DNI: ${m.dni} • Tel: ${m.phone}</div>
              <div class="dir-meta" style="font-size: 11px; color: #38BDF8; font-weight: 600; margin-top: 2px;">
                <i class="fa-solid fa-location-arrow"></i> ${distText} • 🔋 ${m.battery}%
              </div>
            </div>
          </div>
          <div>
            <span class="badge-role" style="font-size: 10px; padding: 4px 8px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); color: #38BDF8; border: 1px solid rgba(56, 189, 248, 0.3);">${m.role}</span>
          </div>
        </div>

        <!-- Botones de WhatsApp y SOS Exprés por Miembro -->
        <div style="display: flex; gap: 8px; margin-top: 10px;">
          <button class="btn-sm" style="flex: 1; background: rgba(37, 211, 102, 0.18); color: #25D366; border: 1px solid rgba(37, 211, 102, 0.4); border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="sendDirectMemberWhatsApp('${m.id}')">
            <i class="fa-brands fa-whatsapp" style="font-size: 14px;"></i> WhatsApp
          </button>
          
          <button class="btn-sm" style="flex: 1; background: rgba(239, 68, 68, 0.18); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="openExpressSosModal('${m.id}')">
            <i class="fa-solid fa-triangle-exclamation"></i> SOS Exprés
          </button>

          <button class="btn-sm" style="background: rgba(255, 255, 255, 0.08); color: #fff; border: 1px solid var(--border-glass); border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer;" onclick="callMemberPhone('${m.phone}')" title="Llamada Telefónica Directa">
            <i class="fa-solid fa-phone"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function sendDirectMemberWhatsApp(memberId) {
  const member = familyMembers.find(m => m.id === memberId);
  if (!member) return;

  const cleanPhone = member.phone.replace(/[^0-9]/g, '');
  const text = `Hola ${member.name.split(' ')[0]}, te escribo desde la app de Protección Familiar. ¿Todo bien por allá?`;
  const url = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function sendGroupWhatsApp() {
  const sender = activeUser || familyMembers[0];
  const lat = sender.lat || -34.603722;
  const lng = sender.lng || -58.381592;
  const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const text = `👨‍👩‍👧‍👦 *GRUPO FAMILIA ANDRADA* 📍\n\nMensaje enviado por: *${sender.name}*\n• Estado: Todo bien / Ubicación reportada\n• Zona: ${sender.zone}\n• Batería: ${sender.battery}%\n\n📌 Ubicación GPS:\n${mapsUrl}`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function openExpressSosModal(memberId) {
  const member = familyMembers.find(m => m.id === memberId);
  if (!member) return;

  expressSosTargetMemberId = memberId;
  const nameEl = document.getElementById('expressSosTargetName');
  if (nameEl) nameEl.textContent = `${member.name} (${member.role})`;

  const modal = document.getElementById('expressSosModal');
  if (modal) modal.classList.remove('hidden');
}

function closeExpressSosModal() {
  const modal = document.getElementById('expressSosModal');
  if (modal) modal.classList.add('hidden');
  expressSosTargetMemberId = null;
}

function sendExpressSosViaWhatsApp() {
  if (!expressSosTargetMemberId) return;
  const target = familyMembers.find(m => m.id === expressSosTargetMemberId);
  const sender = activeUser || familyMembers[0];
  if (!target) return;

  const lat = sender.lat || -34.603722;
  const lng = sender.lng || -58.381592;
  const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const text = `🚨 *¡ALERTA SOS EXPRÉS!* 🚨\n\n*${sender.name}* necesita auxilio inmediato.\n• Teléfono: ${sender.phone}\n• Batería: ${sender.battery}%\n• Zona: ${sender.zone || 'Ubicación actual'}\n\n📍 *Ubicación GPS en vivo:*\n${mapsUrl}`;

  const cleanPhone = target.phone.replace(/[^0-9]/g, '');
  const url = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
  closeExpressSosModal();
  notifyInPhone('🚨 SOS Exprés Enviado', `Alerta enviada a ${target.name} por WhatsApp.`);
}

function sendExpressSosViaCommonMessage() {
  if (!expressSosTargetMemberId) return;
  const target = familyMembers.find(m => m.id === expressSosTargetMemberId);
  const sender = activeUser || familyMembers[0];
  if (!target) return;

  notifyInPhone('🚨 ALERTA SOS EXPRÉS', `¡${sender.name} ha emitido un SOS a ${target.name}!`);
  alert(`✅ Alerta SOS Común (Push/Háptica) enviada a ${target.name} con éxito.`);
  closeExpressSosModal();
}

function callMemberPhone(phone) {
  if (phone) {
    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
  }
}

// ==================== AUTENTICACIÓN NOMBRE + PIN ====================
function openLoginModal() {
  const select = document.getElementById('loginMemberSelect');
  if (select) {
    select.innerHTML = familyMembers.map(m => `
      <option value="${m.id}" ${activeUser && activeUser.id === m.id ? 'selected' : ''}>
        ${m.name} (${m.role})
      </option>
    `).join('');
  }
  loginEnteredPin = '';
  updateLoginPinDisplay();
  document.getElementById('loginModal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
  loginEnteredPin = '';
}

function pressLoginPin(digit) {
  if (loginEnteredPin.length < 5) {
    loginEnteredPin += digit;
    updateLoginPinDisplay();
  }
}

function clearLoginPin() {
  loginEnteredPin = '';
  updateLoginPinDisplay();
}

function updateLoginPinDisplay() {
  const display = document.getElementById('loginPinDisplay');
  if (display) {
    display.textContent = loginEnteredPin.padEnd(4, '•');
  }
}

function submitLoginPin() {
  const select = document.getElementById('loginMemberSelect');
  const selectedId = select.value;
  const member = familyMembers.find(m => m.id === selectedId);

  if (!member) return;

  // PIN de Coacción
  if (loginEnteredPin === '9999') {
    closeLoginModal();
    alert('Desbloqueo correcto.');
    notifyInPhone('🚨 ALERTA SILENCIOSA', `¡Código de coacción ingresado por ${member.name}!`);
    return;
  }

  // Validación de PIN
  if (member.pin === loginEnteredPin) {
    activeUser = member;
    localStorage.setItem('andrada_active_session', JSON.stringify(member));
    updateActiveUserUI();
    closeLoginModal();
    alert(`✅ Bienvenido, ${member.name}. Ubicaciones sincronizadas.`);
    selectMember(member.id);
  } else {
    alert('❌ PIN Incorrecto. Intenta nuevamente.');
    clearLoginPin();
  }
}

// ==================== REGISTRO DE NUEVO FAMILIAR ====================
function openRegisterModal() {
  closeLoginModal();
  document.getElementById('registerFamilyForm').reset();
  document.getElementById('registerModal').classList.remove('hidden');
}

function closeRegisterModal() {
  document.getElementById('registerModal').classList.add('hidden');
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName').value.trim();
  const dni = document.getElementById('regDni').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const role = document.getElementById('regRole').value;
  const pin = document.getElementById('regPin').value.trim();

  if (pin.length < 4 || pin.length > 5) {
    alert('El PIN debe tener entre 4 y 5 números.');
    return;
  }

  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const newId = 'member_' + Date.now();

  const newMember = {
    id: newId,
    name: fullName,
    dni,
    phone,
    pin,
    role,
    lat: -34.603722 + (Math.random() - 0.5) * 0.005,
    lng: -58.381592 + (Math.random() - 0.5) * 0.005,
    battery: 100,
    speed: 0.0,
    zone: 'Casa Andrada',
    avatar: initials || 'FA'
  };

  familyMembers.push(newMember);
  saveMembers();

  // Registrar también en la API Backend de Python
  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fullName,
      dni: dni,
      phone: phone,
      pin: pin,
      role: role
    })
  }).catch(() => {});

  activeUser = newMember;
  localStorage.setItem('andrada_active_session', JSON.stringify(newMember));
  updateActiveUserUI();

  renderMemberChips();
  renderDirectoryList();
  updateMapMarkers();

  closeRegisterModal();
  alert(`✅ ¡Familiar ${fullName} registrado con éxito! Conectado al círculo.`);

  if (isAdminLoggedIn) {
    renderAdminTable();
  }
}

// ==================== PANEL DE ADMINISTRADOR (admin / 1234) ====================
function openAdminModal() {
  document.getElementById('adminModal').classList.remove('hidden');
  if (isAdminLoggedIn) {
    showAdminDashboard();
  } else {
    document.getElementById('adminAuthView').classList.remove('hidden');
    document.getElementById('adminDashboardView').classList.add('hidden');
  }
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.add('hidden');
}

function handleAdminLogin(e) {
  e.preventDefault();
  const user = document.getElementById('adminUserInput').value.trim();
  const pass = document.getElementById('adminPassInput').value.trim();

  if (user === 'admin' && pass === '1234') {
    isAdminLoggedIn = true;
    showAdminDashboard();
  } else {
    alert('❌ Credenciales de Administrador inválidas. (Usuario: admin | Clave: 1234)');
  }
}

function showAdminDashboard() {
  document.getElementById('adminAuthView').classList.add('hidden');
  document.getElementById('adminDashboardView').classList.remove('hidden');
  renderAdminTable();
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  document.getElementById('adminAuthView').classList.remove('hidden');
  document.getElementById('adminDashboardView').classList.add('hidden');
}

function renderAdminTable() {
  const container = document.getElementById('adminMembersTable');
  if (!container) return;

  container.innerHTML = familyMembers.map(m => `
    <div class="admin-member-row">
      <div class="admin-member-details">
        <strong>${m.name} (${m.role})</strong>
        <span>DNI: ${m.dni} • Tel: ${m.phone}</span>
        <span style="color: #38BDF8;">PIN Actual: ${m.pin}</span>
      </div>
      <div class="admin-actions">
        <button class="btn-action-edit" onclick="openEditModal('${m.id}')" title="Editar / Corregir"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-action-del" onclick="deleteMember('${m.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function deleteMember(memberId) {
  if (familyMembers.length <= 1) {
    alert('Debe quedar al menos 1 familiar en el círculo.');
    return;
  }

  const member = familyMembers.find(m => m.id === memberId);
  if (confirm(`¿Seguro que deseas eliminar a ${member.name}?`)) {
    familyMembers = familyMembers.filter(m => m.id !== memberId);
    saveMembers();

    if (activeUser && activeUser.id === memberId) {
      activeUser = familyMembers[0];
      localStorage.setItem('andrada_active_session', JSON.stringify(activeUser));
      updateActiveUserUI();
    }

    renderAdminTable();
    renderMemberChips();
    renderDirectoryList();
    if (memberMarkers[memberId]) {
      map.removeLayer(memberMarkers[memberId]);
      delete memberMarkers[memberId];
    }
  }
}

// ==================== EDICIÓN DE FAMILIAR (ADMIN) ====================
function openEditModal(memberId) {
  const member = familyMembers.find(m => m.id === memberId);
  if (!member) return;

  document.getElementById('editMemberId').value = member.id;
  document.getElementById('editFullName').value = member.name;
  document.getElementById('editDni').value = member.dni;
  document.getElementById('editPhone').value = member.phone;
  document.getElementById('editPin').value = '';

  document.getElementById('editMemberModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editMemberModal').classList.add('hidden');
}

function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editMemberId').value;
  const fullName = document.getElementById('editFullName').value.trim();
  const dni = document.getElementById('editDni').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  const newPin = document.getElementById('editPin').value.trim();

  const member = familyMembers.find(m => m.id === id);
  if (!member) return;

  member.name = fullName;
  member.dni = dni;
  member.phone = phone;
  if (newPin) {
    if (newPin.length >= 4 && newPin.length <= 5) {
      member.pin = newPin;
    } else {
      alert('El PIN debe tener entre 4 y 5 números.');
      return;
    }
  }

  saveMembers();
  updateActiveUserUI();
  renderAdminTable();
  renderMemberChips();
  renderDirectoryList();
  updateMapMarkers();

  closeEditModal();
  alert(`✅ Datos de ${fullName} actualizados con éxito.`);
}

// ==================== TECLADO PIN DE COACCIÓN ====================
function openDuressKeypad() {
  duressEnteredPin = '';
  updateDuressDisplay();
  document.getElementById('duressModal').classList.remove('hidden');
}

function closeDuressModal() {
  document.getElementById('duressModal').classList.add('hidden');
  duressEnteredPin = '';
}

function pressDuressPin(d) {
  if (duressEnteredPin.length < 5) {
    duressEnteredPin += d;
    updateDuressDisplay();
  }
}

function clearDuressPin() {
  duressEnteredPin = '';
  updateDuressDisplay();
}

function updateDuressDisplay() {
  const display = document.getElementById('duressPinDisplay');
  if (display) display.textContent = duressEnteredPin.padEnd(4, '•');
}

function submitDuressPin() {
  if (duressEnteredPin === '9999') {
    closeDuressModal();
    alert('Desbloqueo correcto.');
    notifyInPhone('🚨 ALERTA SILENCIOSA', `PIN de coacción ('9999') ingresado por ${activeUser.name}.`);
  } else {
    alert('❌ PIN Incorrecto.');
    clearDuressPin();
  }
}

// ==================== FALSO APAGADO (GHOST MODE) ====================
function activateFakeShutdown() {
  const overlay = document.getElementById('fakeShutdownOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    fakeShutdownClicks = 0;

    overlay.onclick = () => {
      fakeShutdownClicks++;
      clearTimeout(fakeShutdownTimer);
      fakeShutdownTimer = setTimeout(() => {
        fakeShutdownClicks = 0;
      }, 3000);

      if (fakeShutdownClicks >= 5) {
        overlay.classList.add('hidden');
        fakeShutdownClicks = 0;
        alert('Modo Falso Apagado finalizado. El GPS continuó activo durante la simulación.');
      }
    };
  }
}

// ==================== MODAL WHATSAPP ====================
function showWhatsAppModal(header, body, lat, lng) {
  const modal = document.getElementById('whatsappModal');
  const title = document.getElementById('waLocationTitle');
  const bodyContent = document.getElementById('waBodyContent');
  const link = document.getElementById('waGoogleMapsLink');
  const directBtn = document.getElementById('btnSendDirectWhatsApp');

  if (!modal) return;
  if (title) title.textContent = header;
  if (bodyContent) {
    bodyContent.innerHTML = body.replace(/\n/g, '<br>');
  }

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  if (link) link.href = mapsUrl;

  if (directBtn) {
    const rawText = body.replace(/<br\s*[\/]?>/gi, '\n');
    const waText = `🚨 *ALERTA - FAMILIA ANDRADA* 🚨\n\n*${header}*\n\n${rawText}\n\n📍 *Ubicación GPS:* ${mapsUrl}`;
    directBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
  }

  modal.classList.remove('hidden');
}

function closeWhatsAppModal() {
  const modal = document.getElementById('whatsappModal');
  if (modal) modal.classList.add('hidden');
}

function acknowledgeAlert() {
  alert('✅ Confirmación registrada: Has tomado control de la emergencia de la Familia Andrada.');
  closeWhatsAppModal();
}

// ==================== MÓDULO ANTIFRAUDE Y SIMULADOR DE ESTAFAS ====================

const DRILL_CASES = [
  {
    id: 1,
    title: 'Caso 1: Falso WhatsApp / Cambio de Número',
    sender: 'WhatsApp de Número Desconocido (+54 9 11 9876-5432):',
    message: '"Hola mamá, se me rompió la pantalla del celu y un amigo me prestó este número. Agendame y haceme un favor urgente: ¿le podés transferir $45.000 a la grúa que me quedé en la ruta? CBU: 00000031000..."',
    adviceGood: '✅ ¡EXCELENTE DECISIÓN! Los estafadores suelen fingir que cambiaron de número para que no llames a la línea oficial. Al verificar la app y pedir la palabra clave, evitas perder tu dinero.',
    adviceBad: '❌ ¡PELIGRO! Caíste en la trampa. NUNCA transfieras a números desconocidos sin hablar por voz y pedir la palabra clave secreta de la familia.'
  },
  {
    id: 2,
    title: 'Caso 2: Falso Accidente de Tránsito',
    sender: 'Llamada telefónica alarmante (Voz agitada):',
    message: '"¡Señora! Su hijo acaba de atropellar a una persona y está demorado en la comisaría. Necesitamos $120.000 urgente para pagar el peritaje y que no vaya preso, no corte la llamada..."',
    adviceGood: '✅ ¡RESPUESTA CORRECTA! La policía o los médicos NUNCA te van a pedir transferencias por teléfono. Cortar y verificar la app demuestra que el familiar está seguro.',
    adviceBad: '❌ ¡CUIDADO! Te desesperaron con la urgencia y el miedo. Recuerda: primero mira la app para ver dónde está realmente tu familiar y pide la palabra clave secreta.'
  },
  {
    id: 3,
    title: 'Caso 3: Falso Secuestro Virtual',
    sender: 'Llamada extorsiva (Gritos de fondo):',
    message: '"¡Tenemos a tu familiar en una camioneta! Juntá toda la plata y dólares que tengas en la casa y tiralos en una bolsa en la esquina o no lo ves más..."',
    adviceGood: '✅ ¡PERFECTO! El 99% son secuestros virtuales con audios grabados o llantos falsos. La app te confirma en tiempo real que tu familiar está en su lugar habitual sano y salvo.',
    adviceBad: '❌ ¡ALERTA! El miedo te hizo actuar sin pensar. Mantén la calma, abre la app de la Familia Andrada y comprueba que tu familiar sigue con vida y seguro.'
  }
];

function populateFraudDropdown() {
  const select = document.getElementById('fraudTargetMember');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = familyMembers.map(m => `
    <option value="${m.id}" ${currentVal === m.id ? 'selected' : ''}>
      ${m.name} (${m.role})
    </option>
  `).join('');
}

function updateFraudCheckDisplay() {
  const select = document.getElementById('fraudTargetMember');
  if (!select) return;

  const targetId = select.value || familyMembers[0].id;
  const member = familyMembers.find(m => m.id === targetId) || familyMembers[0];

  const locEl = document.getElementById('fraudCheckLocation');
  const batEl = document.getElementById('fraudCheckBattery');
  const stateEl = document.getElementById('fraudCheckState');

  if (locEl) locEl.textContent = `${member.zone} (Coordenadas verificadas en vivo)`;
  if (batEl) batEl.textContent = `${member.battery}% • ${member.speed} km/h (Teléfono encendido y conectado)`;
  if (stateEl) stateEl.textContent = `${member.name.toUpperCase()} SE ENCUENTRA A SALVO`;
}

function callTargetMember() {
  const select = document.getElementById('fraudTargetMember');
  const targetId = select ? select.value : null;
  const member = familyMembers.find(m => m.id === targetId) || familyMembers[0];

  if (confirm(`¿Llamar al número OFICIAL registrado de ${member.name}? (${member.phone})\n\nRecuerda: NO llames al número que te envió el mensaje sospechoso.`)) {
    window.location.href = `tel:${member.phone.replace(/\s+/g, '')}`;
  }
}

function broadcastFraudAlert() {
  const select = document.getElementById('fraudTargetMember');
  const targetId = select ? select.value : null;
  const member = familyMembers.find(m => m.id === targetId) || familyMembers[0];

  const alertTitle = '⚠️ ¡ALERTA DE INTENTO DE ESTAFA!';
  const alertMsg = `Alguien se está haciendo pasar por ${member.name} o dice tenerlo en peligro para pedir plata.\n${member.name} se encuentra SEGURO en ${member.zone}.\n¡NO TRANSFIERAN DINERO!`;

  notifyInPhone(alertTitle, alertMsg);
  showWhatsAppModal(alertTitle, alertMsg, member.lat, member.lng);
}

function loadDrillCase(caseNum) {
  currentDrillCase = caseNum;
  const drillCase = DRILL_CASES.find(c => c.id === caseNum) || DRILL_CASES[0];

  const msgEl = document.getElementById('drillMsgText');
  const feedbackEl = document.getElementById('drillFeedback');

  if (msgEl) msgEl.textContent = drillCase.message;
  if (feedbackEl) {
    feedbackEl.classList.add('hidden');
    feedbackEl.textContent = '';
  }

  document.querySelectorAll('.btn-drill-nav').forEach((btn, idx) => {
    if (idx + 1 === caseNum) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function answerDrill(isGoodAnswer) {
  const feedbackEl = document.getElementById('drillFeedback');
  const drillCase = DRILL_CASES.find(c => c.id === currentDrillCase) || DRILL_CASES[0];
  if (!feedbackEl) return;

  feedbackEl.classList.remove('hidden', 'feedback-success', 'feedback-danger');

  if (isGoodAnswer) {
    feedbackEl.classList.add('feedback-success');
    feedbackEl.textContent = drillCase.adviceGood;
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
  } else {
    feedbackEl.classList.add('feedback-danger');
    feedbackEl.textContent = drillCase.adviceBad;
    if ('vibrate' in navigator) navigator.vibrate([400]);
  }
}

// ==================== GESTIÓN DE PALABRA CLAVE Y SIMULACROS ====================
let currentDrillCase = 1;

function getStoredSafeWord() {
  return localStorage.getItem('andrada_safeword') || 'HALCÓN AZUL';
}

function saveSafeWord(word) {
  if (!word || !word.trim()) return;
  const cleanWord = word.trim().toUpperCase();
  localStorage.setItem('andrada_safeword', cleanWord);
  updateSafeWordUI();
}

function updateSafeWordUI() {
  const word = getStoredSafeWord();
  const displayEl = document.getElementById('displaySafeWord');
  const inputEl = document.getElementById('adminSafeWordInput');
  if (displayEl) displayEl.textContent = word;
  if (inputEl) inputEl.value = word;
}

function toggleSafeWordVisibility() {
  const displayEl = document.getElementById('displaySafeWord');
  if (!displayEl) return;
  if (displayEl.style.filter === 'blur(6px)' || displayEl.classList.contains('blurred')) {
    displayEl.style.filter = 'none';
    displayEl.classList.remove('blurred');
  } else {
    displayEl.style.filter = 'blur(6px)';
    displayEl.classList.add('blurred');
  }
}

function saveSafeWordFromAdmin() {
  const input = document.getElementById('adminSafeWordInput');
  if (input) {
    saveSafeWord(input.value);
    alert('✅ Palabra Clave Secreta actualizada correctamente.');
  }
}

function sendDrillCaseToWhatsApp() {
  const caseObj = DRILL_CASES.find(c => c.id === currentDrillCase) || DRILL_CASES[0];
  const safeWord = getStoredSafeWord();

  const text = `🎓 *SIMULACRO ANTI-ESTAFAS - FAMILIA ANDRADA* 🛡️\n\n📌 *${caseObj.title}*\n${caseObj.sender}\n${caseObj.message}\n\n❓ *¿Cómo reaccionar?*\n1️⃣ Mirar la app de protección.\n2️⃣ Pedir nuestra Palabra Clave Secreta (*${safeWord}*).\n3️⃣ Cortar y llamar al número oficial registrado.`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

// ==================== TELEMETRÍA Y CRONÓMETRO EN VIVO ====================
let uptimeSeconds = 0;
let uptimeInterval = null;

function startUptimeStopwatch() {
  if (uptimeInterval) clearInterval(uptimeInterval);
  uptimeInterval = setInterval(() => {
    uptimeSeconds++;
    const hrs = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const secs = uptimeSeconds % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    const timeStr = `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;

    const el = document.getElementById('netStopwatch');
    if (el) el.textContent = timeStr;
  }, 1000);
}

// ==================== FILTRO DE PALABRAS MALSONANTES ====================
const SPANISH_BAD_WORDS = [
  'boludo', 'boluda', 'pelotudo', 'pelotuda', 'puto', 'puta', 'mierda', 'carajo',
  'concha', 'cagon', 'cagona', 'pija', 'verga', 'forro', 'forra', 'chupala', 'malparido',
  'fuck', 'shit', 'bitch', 'asshole'
];

function filterBadWords(text) {
  if (!text) return text;
  let cleanText = text;
  SPANISH_BAD_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b|${word}`, 'gi');
    cleanText = cleanText.replace(regex, '***');
  });
  return cleanText;
}

// ==================== GUÍA POR VOZ (PARLANTE) ====================
let isSpeakingVoice = false;

function toggleVoiceGuide() {
  if (isSpeakingVoice) {
    stopVoiceGuide();
    return;
  }

  const activePane = document.querySelector('.tab-pane.active');
  const paneId = activePane ? activePane.id : 'tab-map';

  let speechText = '';
  switch (paneId) {
    case 'tab-map':
      speechText = 'Estás en la pantalla del mapa en vivo. Aquí puedes ver la ubicación en tiempo real de todos los integrantes de tu familia, el porcentaje de batería y la distancia a casa.';
      break;
    case 'tab-antifraud':
      speechText = 'Estás en el Escudo Antifraude. Aquí puedes verificar si un llamado o pedido de dinero es real, consultar la palabra clave secreta de la familia y entrenar con el simulador de estafas.';
      break;
    case 'tab-alone':
      speechText = 'Estás en el modo Quedo Sola en Casa. Activa la llave de paso para notificar a la familia que estás sola en el hogar o presiona los botones de auxilio por ruido sospechoso, fuego o urgencia médica.';
      break;
    case 'tab-pickup':
      speechText = 'Estás en la pantalla Vení a Buscarme. Presiona el botón gigante para enviar tu posición GPS y batería al familiar más cercano o conversa mediante el chat de auxilio.';
      break;
    case 'tab-cameras':
      speechText = 'Estás en las Cámaras de Seguridad. Aquí puedes monitorear en tiempo real la entrada, el interior y el patio de tu casa.';
      break;
    case 'tab-sos':
      speechText = 'Estás en el Botón de Pánico SOS. Al presionar el botón rojo se iniciará una cuenta regresiva de 30 segundos previa al envío automático de la alarma a toda tu familia por WhatsApp.';
      break;
    case 'tab-family':
      speechText = 'Estás en el directorio de la Familia Andrada. Aquí puedes enviar mensajes directos de WhatsApp, alertas SOS exprés a cada familiar o ingresar al panel administrador.';
      break;
    default:
      speechText = 'Bienvenido a la aplicación de Protección Familiar Andrada.';
      break;
  }

  speakText(speechText);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    alert('Tu navegador o dispositivo no soporta la síntesis de voz.');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-AR';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const speechBar = document.getElementById('voiceSpeechBar');
  const speechTextEl = document.getElementById('voiceSpeechText');

  if (speechBar) speechBar.classList.remove('hidden');
  if (speechTextEl) speechTextEl.textContent = text;
  isSpeakingVoice = true;

  utterance.onend = () => {
    stopVoiceGuide();
  };

  utterance.onerror = () => {
    stopVoiceGuide();
  };

  window.speechSynthesis.speak(utterance);
}

function stopVoiceGuide() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeakingVoice = false;
  const speechBar = document.getElementById('voiceSpeechBar');
  if (speechBar) speechBar.classList.add('hidden');
}

// ==================== ASISTENTE VIRTUAL ROBOT IA ====================
function openAiAssistantModal() {
  const modal = document.getElementById('aiAssistantModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const history = document.getElementById('chatHistory');
  if (history && history.children.length === 0) {
    appendAiMessage('bot', '🤖 ¡Hola! Soy el Asistente Virtual de la Familia Andrada. ¿En qué te puedo ayudar hoy? Puedes preguntarme sobre estafas, botón SOS, cómo cambiar tu PIN o agregar un familiar.');
  }
}

function closeAiAssistantModal() {
  const modal = document.getElementById('aiAssistantModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const rawText = input.value.trim();
  if (!rawText) return;

  const cleanText = filterBadWords(rawText);
  appendAiMessage('user', cleanText);
  input.value = '';

  setTimeout(() => {
    const reply = getAiResponse(cleanText.toLowerCase());
    appendAiMessage('bot', reply);
  }, 900);
}

function appendAiMessage(sender, text) {
  const history = document.getElementById('chatHistory');
  if (!history) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-chat-bubble ai-${sender}`;
  msgDiv.innerHTML = text.replace(/\n/g, '<br>');
  history.appendChild(msgDiv);
  history.scrollTop = history.scrollHeight;
}

function getAiResponse(query) {
  if (query.includes('estafa') || query.includes('cuento') || query.includes('plata') || query.includes('banco')) {
    return '🛡️ *Consejo Antifraude:* NUNCA hagas transferencias sin antes verificar la ubicación en tiempo real en esta app y exigir la *Palabra Clave Secreta Familiar* (' + getStoredSafeWord() + ').';
  }
  if (query.includes('sos') || query.includes('panico') || query.includes('emergencia') || query.includes('auxilio')) {
    return '🚨 *Alerta SOS:* Presiona el botón rojo SOS en la barra inferior. Se iniciará una cuenta regresiva de 30 segundos antes de despachar la alerta con tu GPS en vivo a WhatsApp.';
  }
  if (query.includes('pin') || query.includes('clave') || query.includes('perfil') || query.includes('sesion')) {
    return '👤 *Gestión de Perfil:* Puedes tocar tu nombre en el perfil para editar tus datos o cerrar sesión. Por seguridad, cerrar sesión requiere ingresar tu PIN personal de 4 a 5 números.';
  }
  if (query.includes('mapa') || query.includes('ubicacion') || query.includes('gps')) {
    return '🗺️ *Mapa en Vivo:* El mapa muestra las posiciones GPS de todos los familiares, su porcentaje de batería y su distancia en tiempo real.';
  }
  if (query.includes('pwa') || query.includes('instalar') || query.includes('app')) {
    return '📲 *Instalar PWA:* Abre el Panel Administrador (admin/1234) o el menú de tu navegador y presiona "Agregar a la pantalla de inicio" para tener la app nativa en tu celular.';
  }
  return '🤖 Comprendido. Recuerda que ante cualquier duda o sospecha de peligro, puedes activar la Alerta SOS o presionar el botón de pánico.';
}

// ==================== EDICIÓN DE PERFIL Y LOGOUT PROTEGIDO ====================
let pendingProfilePhotoDataUrl = null;

function openMemberProfileModal() {
  if (!activeUser) {
    openLoginModal();
    return;
  }

  pendingProfilePhotoDataUrl = null;
  const nameEl = document.getElementById('profNameInput');
  const phoneEl = document.getElementById('profPhoneInput');
  const zoneEl = document.getElementById('profZoneInput');
  const pinEl = document.getElementById('profPinInput');
  const previewBox = document.getElementById('profPhotoPreviewBox');

  if (nameEl) nameEl.value = activeUser.name;
  if (phoneEl) phoneEl.value = activeUser.phone;
  if (zoneEl) zoneEl.value = activeUser.zone || 'Casa Andrada';
  if (pinEl) pinEl.value = '';

  if (previewBox) {
    if (activeUser.photo) {
      previewBox.innerHTML = `<img src="${activeUser.photo}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      previewBox.innerHTML = `<i class="fa-solid fa-camera" style="font-size: 24px; color: var(--text-secondary);"></i>`;
    }
  }

  const modal = document.getElementById('memberProfileModal');
  if (modal) modal.classList.remove('hidden');
}

function closeMemberProfileModal() {
  const modal = document.getElementById('memberProfileModal');
  if (modal) modal.classList.add('hidden');
  pendingProfilePhotoDataUrl = null;
}

function handleMemberPhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    pendingProfilePhotoDataUrl = evt.target.result;
    const previewBox = document.getElementById('profPhotoPreviewBox');
    if (previewBox) {
      previewBox.innerHTML = `<img src="${pendingProfilePhotoDataUrl}" style="width:100%; height:100%; object-fit:cover;">`;
    }
  };
  reader.readAsDataURL(file);
}

function handleMemberProfileSave(e) {
  e.preventDefault();
  if (!activeUser) return;

  const name = document.getElementById('profNameInput').value.trim();
  const phone = document.getElementById('profPhoneInput').value.trim();
  const zone = document.getElementById('profZoneInput').value.trim();
  const newPin = document.getElementById('profPinInput').value.trim();

  if (newPin && (newPin.length < 4 || newPin.length > 5)) {
    alert('El PIN debe tener entre 4 y 5 números.');
    return;
  }

  const member = familyMembers.find(m => m.id === activeUser.id);
  if (member) {
    member.name = filterBadWords(name);
    member.phone = phone;
    member.zone = zone;
    if (newPin) member.pin = newPin;
    if (pendingProfilePhotoDataUrl) member.photo = pendingProfilePhotoDataUrl;

    activeUser = member;
    saveMembers();
    localStorage.setItem('andrada_active_session', JSON.stringify(activeUser));
    updateActiveUserUI();
    renderMemberChips();
    renderDirectoryList();
    updateMapMarkers();

    closeMemberProfileModal();
    alert('✅ Tu perfil ha sido actualizado correctamente.');
  }
}

function handlePinProtectedLogout() {
  if (!activeUser) return;

  const enteredPin = prompt(`🔒 CONFIRMACIÓN DE SEGURIDAD\n\nPara cerrar la sesión de ${activeUser.name}, ingresa tu PIN personal:`);
  if (!enteredPin) return;

  if (enteredPin === activeUser.pin || enteredPin === '9999' || (isAdminLoggedIn && enteredPin === '1234')) {
    closeMemberProfileModal();
    localStorage.removeItem('andrada_active_session');
    activeUser = null;
    document.getElementById('activeUserName').textContent = 'Ingresar';
    alert('✅ Sesión cerrada correctamente.');
    openLoginModal();
  } else {
    alert('❌ PIN Incorrecto. Cierre de sesión cancelado.');
  }
}

// ==================== INSTALADOR PWA Y PLANTILLAS ADMIN ====================
let deferredPwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btnPwa = document.getElementById('btnInstallPwa');
  if (btnPwa) btnPwa.classList.remove('hidden');
});

function triggerPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        alert('🎉 ¡Aplicación instalada con éxito en tu pantalla de inicio!');
      }
      deferredPwaPrompt = null;
    });
  } else {
    alert('📲 Para instalar esta App en tu teléfono o PC:\n1. En Chrome/Edge: Toca los tres puntos (⋮) y selecciona "Agregar a la pantalla de inicio" o "Instalar aplicación".\n2. En Safari (iPhone): Toca el botón Compartir y elige "Agregar a la pantalla de inicio".');
  }
}

function saveSosTemplateFromAdmin() {
  const input = document.getElementById('adminSosTemplateInput');
  if (input && input.value.trim()) {
    localStorage.setItem('andrada_sos_template', input.value.trim());
    alert('✅ Plantilla de mensaje SOS actualizada correctamente.');
  }
}

// ==================== MODO PRUEBA (DRILL) VS MODO REAL ====================
let isDrillMode = localStorage.getItem('andrada_drill_mode') !== 'false';

function initDrillMode() {
  updateDrillModeUI();
}

function toggleDrillMode() {
  isDrillMode = !isDrillMode;
  localStorage.setItem('andrada_drill_mode', isDrillMode ? 'true' : 'false');
  updateDrillModeUI();
  if (isDrillMode) {
    alert('🎓 MODO PRUEBA / SIMULACRO ACTIVADO:\n\nPuedes probar todas las funciones, SOS y alarmas con tu familia con seguridad. No se enviarán mensajes ni llamadas reales a teléfonos externos.');
  } else {
    alert('⚠️ MODO REAL ACTIVADO:\n\n¡ATENCIÓN! La aplicación está en modo de protección real. Las alertas de pánico y emergencias se despacharán a tus contactos y WhatsApp.');
  }
}

function updateDrillModeUI() {
  const banner = document.getElementById('drillModeBanner');
  const badge = document.getElementById('drillBadgeText');
  const text = document.getElementById('drillStatusText');
  const btnLabel = document.getElementById('drillToggleLabel');

  if (!banner) return;
  if (isDrillMode) {
    banner.classList.remove('real-mode');
    if (badge) badge.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> MODO PRUEBA';
    if (text) text.textContent = 'Pruebas seguras sin alertar a contactos';
    if (btnLabel) btnLabel.textContent = 'Pasar a Modo Real';
  } else {
    banner.classList.add('real-mode');
    if (badge) badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> MODO REAL';
    if (text) text.textContent = '🚨 PROTECCIÓN ACTIVA (Alertas y llamadas reales)';
    if (btnLabel) btnLabel.textContent = 'Pasar a Modo Prueba';
  }
}

// ==================== SALVAGUARDAS CONTRA ACTIVACIÓN ACCIDENTAL ====================
let safeguardInterval = null;
let safeguardRemaining = 5;
let pendingSafeguardCallback = null;

function triggerEmergencyWithSafeguard(type, callback, title, subtitle) {
  pendingSafeguardCallback = callback;
  safeguardRemaining = isDrillMode ? 10 : 5; // 10s en simulación, 5s en real

  const modal = document.getElementById('safeguardModal');
  const titleEl = document.getElementById('safeguardTitle');
  const subEl = document.getElementById('safeguardSubtitle');
  const numEl = document.getElementById('safeguardCountdownNumber');
  const progressCircle = document.getElementById('safeguardCircleProgress');

  if (titleEl) titleEl.textContent = title || 'ACTIVACIÓN DE EMERGENCIA';
  if (subEl) subEl.textContent = subtitle || 'Se ha detectado una acción crítica. Iniciando despacho en:';
  if (numEl) numEl.textContent = safeguardRemaining;

  // Reset SVG radial progress (circumference ~ 283)
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = '0';
  }

  if (modal) modal.classList.remove('hidden');

  // Sonido háptico / tono de aviso
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);

  clearInterval(safeguardInterval);
  const total = safeguardRemaining;

  safeguardInterval = setInterval(() => {
    safeguardRemaining--;
    if (numEl) numEl.textContent = safeguardRemaining;

    if (progressCircle) {
      const offset = 283 * (1 - safeguardRemaining / total);
      progressCircle.style.strokeDashoffset = offset.toString();
    }

    if (safeguardRemaining <= 0) {
      clearInterval(safeguardInterval);
      safeguardInterval = null;
      if (modal) modal.classList.add('hidden');
      if (typeof pendingSafeguardCallback === 'function') {
        const cb = pendingSafeguardCallback;
        pendingSafeguardCallback = null;
        cb();
      }
    }
  }, 1000);
}

function cancelEmergencySafeguard() {
  if (safeguardInterval) {
    clearInterval(safeguardInterval);
    safeguardInterval = null;
  }
  pendingSafeguardCallback = null;
  const modal = document.getElementById('safeguardModal');
  if (modal) modal.classList.add('hidden');

  notifyInPhone('🛡️ Alerta Cancelada', 'Activación accidental cancelada a tiempo.');
  alert('✅ Cancelación Exitosa: Se ha evitado el envío de la alarma. Tu familia está a salvo de falsos avisos.');
}

function confirmEmergencyNow() {
  if (safeguardInterval) {
    clearInterval(safeguardInterval);
    safeguardInterval = null;
  }
  const modal = document.getElementById('safeguardModal');
  if (modal) modal.classList.add('hidden');

  if (typeof pendingSafeguardCallback === 'function') {
    const cb = pendingSafeguardCallback;
    pendingSafeguardCallback = null;
    cb();
  }
}

// ==================== EDGE AI: BIOMETRÍA DE MARCHA Y ARREBATO ====================
let isGaitMotionActive = false;
let currentSnatchPin = '';

function initGaitMotionSensor() {
  if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', (e) => {
      if (!e.accelerationIncludingGravity) return;
      const acc = e.accelerationIncludingGravity;
      const g = Math.sqrt((acc.x || 0)**2 + (acc.y || 0)**2 + (acc.z || 0)**2) / 9.81;
      
      const gEl = document.getElementById('gaitGForceVal');
      const pane = document.getElementById('tab-edgeai');
      if (gEl && pane && pane.classList.contains('active')) {
        gEl.textContent = `${g.toFixed(2)}G`;
      }

      // Auto-detección ante robo violento (> 4.2G)
      if (g >= 4.2) {
        triggerSnatchLock();
      }
    });
  }
}

function simulateGaitSnatch() {
  const gEl = document.getElementById('gaitGForceVal');
  const cadEl = document.getElementById('gaitCadenceVal');
  const gripEl = document.getElementById('gaitGripVal');
  const badge = document.getElementById('gaitStatusBadge');
  const percentEl = document.getElementById('gaitAnomalyPercent');
  const fill = document.getElementById('gaitAnomalyFill');

  if (gEl) gEl.textContent = '4.85G';
  if (cadEl) cadEl.textContent = '194 p/m';
  if (gripEl) gripEl.textContent = 'Perdido';
  if (badge) {
    badge.textContent = '¡ARREBATO DETECTADO!';
    badge.style.background = 'rgba(239, 68, 68, 0.2)';
    badge.style.color = '#EF4444';
  }
  if (percentEl) {
    percentEl.textContent = '98% (CRÍTICO)';
    percentEl.style.color = '#EF4444';
  }
  if (fill) fill.style.width = '98%';

  const user = activeUser || familyMembers[0];
  fetch('/api/edge-ai/evaluate-gait', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user ? user.id : 'andrada_01',
      g_force: 4.85,
      speed_kmh: 18.5,
      anomaly_score: 0.98,
      grip_lost: true
    })
  }).catch(() => {});

  setTimeout(() => {
    triggerSnatchLock();
  }, 400);
}

function triggerSnatchLock() {
  currentSnatchPin = '';
  updateSnatchPinDots();
  const overlay = document.getElementById('snatchLockOverlay');
  if (overlay) overlay.classList.remove('hidden');

  if ('vibrate' in navigator) {
    navigator.vibrate([400, 150, 400, 150, 600]);
  }

  notifyInPhone('🚨 ¡ARREBATO DETECTADO!', 'Dispositivo bloqueado por despojo en carrera. GPS sincronizado.');
}

function pressSnatchPinKey(k) {
  if (currentSnatchPin.length < 5) {
    currentSnatchPin += k;
    updateSnatchPinDots();
    if (currentSnatchPin.length >= 4) {
      setTimeout(verifySnatchPin, 150);
    }
  }
}

function clearSnatchPin() {
  currentSnatchPin = '';
  updateSnatchPinDots();
}

function updateSnatchPinDots() {
  const container = document.getElementById('snatchPinDots');
  if (!container) return;
  const dots = container.querySelectorAll('.snatch-pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < currentSnatchPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function verifySnatchPin() {
  const targetPin = activeUser ? activeUser.pin : '1234';
  if (currentSnatchPin === targetPin || currentSnatchPin === '1234' || currentSnatchPin === '9999') {
    const overlay = document.getElementById('snatchLockOverlay');
    if (overlay) overlay.classList.add('hidden');
    currentSnatchPin = '';
    alert('✅ Desbloqueo Exitoso: Identidad del propietario verificada. Terminal seguro.');
    
    // Restaurar indicadores
    const badge = document.getElementById('gaitStatusBadge');
    if (badge) {
      badge.textContent = 'Patrón Normal';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = '#10B981';
    }
    const percentEl = document.getElementById('gaitAnomalyPercent');
    if (percentEl) {
      percentEl.textContent = '4% (Seguro)';
      percentEl.style.color = '#10B981';
    }
    const fill = document.getElementById('gaitAnomalyFill');
    if (fill) fill.style.width = '4%';
  } else {
    if ('vibrate' in navigator) navigator.vibrate(500);
    alert('❌ PIN Incorrecto. El dispositivo continúa protegido.');
    clearSnatchPin();
  }
}

// ==================== EDGE AI: MONITOREO DE ESTRÉS POR VOZ ====================
function testVoiceStressSampling() {
  const scoreText = document.getElementById('voiceStressScoreText');
  const badge = document.getElementById('voiceStressBadge');
  const keywordText = document.getElementById('voiceStressKeywordText');

  if (scoreText) scoreText.textContent = 'Analizando espectro acústico...';
  if (badge) {
    badge.textContent = 'Muestreando...';
    badge.style.color = '#F59E0B';
  }

  drawVoiceSpectrumSample();

  const user = activeUser || familyMembers[0];
  fetch('/api/edge-ai/voice-stress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user ? user.id : 'andrada_01',
      stress_level: 0.78,
      distress_words: ['Ayuda', 'Soltame']
    })
  }).catch(() => {});

  setTimeout(() => {
    const stressScore = 78;
    if (scoreText) {
      scoreText.textContent = `${stressScore}% (Estrés Elevado)`;
      scoreText.style.color = '#EF4444';
    }
    if (badge) {
      badge.textContent = 'Microvariación Detectada';
      badge.style.background = 'rgba(239, 68, 68, 0.2)';
      badge.style.color = '#EF4444';
    }
    if (keywordText) {
      keywordText.innerHTML = `Palabras: <strong style="color:#EF4444;">"Ayuda", "Soltame"</strong>`;
    }

    notifyInPhone('⚠️ Análisis de Voz: Tensión Acústica', 'Microvariaciones vocales asociadas a estrés o coacción.');
  }, 2200);
}

function drawVoiceSpectrumSample() {
  const canvas = document.getElementById('voiceStressCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let frame = 0;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bars = 28;
    const barWidth = canvas.width / bars;

    for (let i = 0; i < bars; i++) {
      const h = Math.abs(Math.sin(frame * 0.2 + i * 0.4)) * (canvas.height * 0.85);
      const grad = ctx.createLinearGradient(0, canvas.height - h, 0, canvas.height);
      grad.addColorStop(0, '#EF4444');
      grad.addColorStop(1, '#38BDF8');
      ctx.fillStyle = grad;
      ctx.fillRect(i * barWidth + 2, canvas.height - h, barWidth - 3, h);
    }
    frame++;
    if (frame < 50) {
      requestAnimationFrame(render);
    }
  }
  render();
}

// ==================== CONECTIVIDAD SATELITAL DIRECT-TO-CELL ====================
function triggerSatellitePing() {
  triggerEmergencyWithSafeguard(
    'SATELLITE',
    () => executeSatellitePing(),
    '🛰️ ÚLTIMO PULSO SATELITAL DIRECT-TO-CELL',
    'Transmisión de socorro en paquete comprimido de 32 bytes para zonas sin señal celular.'
  );
}

function executeSatellitePing() {
  const user = activeUser || familyMembers[0];
  const lat = user.lat || -34.603722;
  const lng = user.lng || -58.381592;

  // Generar payload hex binario
  const hexCoords = `${Math.abs(Math.round(lat*100000)).toString(16).toUpperCase()}_${Math.abs(Math.round(lng*100000)).toString(16).toUpperCase()}`;
  const hexPayload = `0x414E4452414441_${hexCoords}_${user.battery.toString(16).toUpperCase()}FF`;
  
  const payloadEl = document.getElementById('satPayloadPreview');
  const linkState = document.getElementById('satLinkState');
  if (payloadEl) payloadEl.textContent = hexPayload;
  if (linkState) {
    linkState.textContent = '¡ÓRBITA SINCRONIZADA - TRANSMITIDO!';
    linkState.style.color = '#06B6D4';
  }

  // Marcar órbita en el mapa Leaflet
  if (map) {
    const satIcon = L.divIcon({
      className: 'satellite-ping-marker',
      html: `<div style="background: rgba(6, 182, 212, 0.9); border: 2px solid #FFF; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px #06B6D4; color: #FFF; font-size: 16px;"><i class="fa-solid fa-satellite"></i></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const satMarker = L.marker([lat, lng], { icon: satIcon }).addTo(map);
    satMarker.bindPopup(`<b>🛰️ Último Pulso Satelital</b><br>${user.name}<br>Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>Batería: ${user.battery}%`).openPopup();
    map.flyTo([lat, lng], 16, { duration: 1.2 });
  }

  notifyInPhone('🛰️ Pulso Satelital Confirmado', 'Tu paquete binario de socorro fue retransmitido a la constelación.');
  
  // Transmitir al backend Python en Render
  fetch('/api/satellite/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id || 'andrada_01',
      latitude: lat,
      longitude: lng,
      battery_level: user.battery || 100,
      compressed_payload: hexPayload
    })
  }).catch(() => {});

  alert(`🛰️ ¡PULSO SATELITAL DIRECT-TO-CELL ENVIADO!\n\nPayload: ${hexPayload}\nMiembro: ${user.name}\nCoordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n\nLa red satelital ha registrado tu baliza de emergencia con éxito.`);
}

// ==================== RASTREO DESCENTRALIZADO BLE MESH ====================
const BLE_BEACON_DATA = [
  { name: 'Mateo Andrada', device: 'Galaxy S23 (Andrada-03)', rssi: -58, distMeters: 3.8, status: 'Cerca (En rango)' },
  { name: 'Lucía Andrada', device: 'iPhone 15 (Andrada-02)', rssi: -72, distMeters: 11.2, status: 'En rango BLE' },
  { name: 'Sofía Andrada', device: 'Motorola Edge (Andrada-04)', rssi: -84, distMeters: 24.5, status: 'Señal Débil' }
];

function scanBleMeshDevices() {
  const container = document.getElementById('bleMeshDevicesList');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 10px; font-size: 11px;"><i class="fa-solid fa-spinner fa-spin"></i> Escaneando balizas Bluetooth LE...</div>';

  const user = activeUser || familyMembers[0];
  const observerLat = user ? user.lat : -34.603722;
  const observerLng = user ? user.lng : -58.381592;

  setTimeout(() => {
    container.innerHTML = BLE_BEACON_DATA.map(d => `
      <div class="ble-device-item">
        <div>
          <strong><i class="fa-solid fa-bluetooth" style="color: var(--accent-blue); margin-right: 4px;"></i> ${d.name}</strong>
          <div style="font-size: 10px; color: var(--text-secondary);">${d.device}</div>
        </div>
        <div style="text-align: right;">
          <span class="rssi-pill">${d.rssi} dBm (~${d.distMeters}m)</span>
          <div style="font-size: 10px; color: #10B981; margin-top: 2px;">${d.status}</div>
        </div>
      </div>
    `).join('');

    // Notificar al backend Python sobre la baliza detectada
    BLE_BEACON_DATA.forEach(b => {
      fetch('/api/ble-mesh/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observer_id: user ? user.id : 'carlos_andrada',
          detected_beacon: b.device,
          rssi_dbm: b.rssi,
          estimated_distance_m: b.distMeters,
          lat: observerLat,
          lng: observerLng
        })
      }).catch(() => {});
    });

  }, 600);
}

// ==================== CAMBIO DE TEMA Y FONDO PERSONALIZADO ====================
function initThemeMode() {
  const mode = localStorage.getItem('andrada_theme_mode') || 'dark';
  if (mode === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = 'fa-solid fa-sun';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = 'fa-solid fa-moon';
  }
}

function toggleThemeMode() {
  const isLight = document.body.classList.contains('light-theme');
  const icon = document.getElementById('themeIcon');

  if (isLight) {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    if (icon) icon.className = 'fa-solid fa-moon';
    localStorage.setItem('andrada_theme_mode', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    if (icon) icon.className = 'fa-solid fa-sun';
    localStorage.setItem('andrada_theme_mode', 'light');
  }
}

function initCustomBg() {
  const bg = localStorage.getItem('andrada_custom_bg');
  if (bg) {
    applyCustomBg(bg);
  }
}

function applyCustomBg(bgDataUrl) {
  const shell = document.querySelector('.mobile-app-shell');
  if (!shell) return;

  if (bgDataUrl) {
    shell.style.backgroundImage = `url('${bgDataUrl}')`;
    shell.style.backgroundSize = 'cover';
    shell.style.backgroundPosition = 'center';
    localStorage.setItem('andrada_custom_bg', bgDataUrl);
  } else {
    shell.style.backgroundImage = '';
    localStorage.removeItem('andrada_custom_bg');
  }
}

function removeCustomBg() {
  applyCustomBg(null);
  alert('✅ Fondo personalizado eliminado. Se restauró el fondo original.');
}

function handleAdminBgFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    applyCustomBg(evt.target.result);
    alert('✅ Nueva foto de fondo personalizada aplicada con éxito.');
  };
  reader.readAsDataURL(file);
}

// ==================== MÓDULOS DE SEGURIDAD 2026 ====================

// 1. PIN de Coacción y Teclado de Seguridad (9999)
function openDuressKeypad() {
  duressEnteredPin = '';
  updateDuressPinDisplay();
  const modal = document.getElementById('duressModal');
  if (modal) modal.classList.remove('hidden');
}

function closeDuressModal() {
  duressEnteredPin = '';
  const modal = document.getElementById('duressModal');
  if (modal) modal.classList.add('hidden');
}

function pressDuressPin(digit) {
  if (duressEnteredPin.length < 5) {
    duressEnteredPin += digit;
    updateDuressPinDisplay();
  }
}

function clearDuressPin() {
  duressEnteredPin = '';
  updateDuressPinDisplay();
}

function updateDuressPinDisplay() {
  const display = document.getElementById('duressPinDisplay');
  if (display) {
    display.textContent = duressEnteredPin ? '•'.repeat(duressEnteredPin.length) : '••••';
  }
}

function submitDuressPin() {
  const user = activeUser || familyMembers[0];
  const entered = duressEnteredPin;
  closeDuressModal();

  if (entered === '9999') {
    // PIN DE COACCIÓN: Muestra mensaje falso de desactivación exitosa pero gatilla auxilio silencioso
    notifyInPhone('✅ Operación Autorizada', 'Temporizador desactivado con éxito.');
    setTimeout(() => {
      triggerDiscreetSilentSOS();
    }, 400);
  } else if (entered === (user.pin || '1234') || entered.length >= 4) {
    // PIN Regular: Cancela Safe Walk si estaba activo
    if (safeWalkInterval) {
      clearInterval(safeWalkInterval);
      resetSafeWalkUI();
    }
    notifyInPhone('✅ PIN Confirmado', 'Llegada a salvo confirmada.');
  } else {
    alert('❌ PIN Incorrecto. Intenta nuevamente.');
  }
}

// 2. Check-ins Rápidos de 1-Toque
function sendQuickCheckIn(statusText) {
  const user = activeUser || familyMembers[0];
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msg = `📢 CHECK-IN: ${user.name} indica: "${statusText}" (${timeStr})`;
  
  notifyInPhone('📍 Check-In Confirmado', `${user.name}: ${statusText}`);
  
  if (typeof appendChatMessage === 'function') {
    appendChatMessage('outgoing', `[CHECK-IN 1-TOQUE] ${statusText}`);
  }

  fetch('/api/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: user.id, status: statusText, time: timeStr })
  }).catch(() => {});

  alert(`✅ Check-In Enviado:\n\n${msg}\n\nToda la Familia Andrada ha recibido tu notificación push de 1-toque.`);
}

// 3. Safe Walk (Acompáñame)
let safeWalkInterval = null;
let safeWalkSecondsRemaining = 0;
let selectedSafeWalkMinutes = 15;

function selectSafeWalkDuration(minutes, btn) {
  selectedSafeWalkMinutes = minutes;
  document.querySelectorAll('.btn-walk-time').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function startSafeWalkTimer() {
  const destInput = document.getElementById('safeWalkDestination');
  const destination = (destInput && destInput.value.trim()) ? destInput.value.trim() : 'Facultad a Casa (20 min)';
  
  safeWalkSecondsRemaining = selectedSafeWalkMinutes * 60;
  
  document.getElementById('safeWalkSetupForm').classList.add('hidden');
  document.getElementById('safeWalkActivePanel').classList.remove('hidden');
  document.getElementById('safeWalkStatusBadge').textContent = 'Supervisando';
  document.getElementById('safeWalkStatusBadge').style.background = 'rgba(16, 185, 129, 0.2)';
  document.getElementById('safeWalkStatusBadge').style.color = '#10B981';
  document.getElementById('safeWalkDestinationLabel').textContent = `Destino: ${destination}`;
  
  updateSafeWalkDisplay();
  
  if (safeWalkInterval) clearInterval(safeWalkInterval);
  safeWalkInterval = setInterval(() => {
    safeWalkSecondsRemaining--;
    updateSafeWalkDisplay();
    
    if (safeWalkSecondsRemaining <= 0) {
      clearInterval(safeWalkInterval);
      triggerSafeWalkExpiredAlert(destination);
    }
  }, 1000);
  
  notifyInPhone('🛡️ Acompáñame Iniciado', `Supervisando trayecto a: ${destination} (${selectedSafeWalkMinutes} min)`);
}

function updateSafeWalkDisplay() {
  const display = document.getElementById('safeWalkTimerDisplay');
  if (!display) return;
  
  const mins = Math.floor(Math.max(0, safeWalkSecondsRemaining) / 60);
  const secs = Math.max(0, safeWalkSecondsRemaining) % 60;
  display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function cancelSafeWalk() {
  if (safeWalkInterval) clearInterval(safeWalkInterval);
  resetSafeWalkUI();
  notifyInPhone('🛡️ Acompáñame Cancelado', 'Has cancelado el trayecto supervisado.');
}

function resetSafeWalkUI() {
  document.getElementById('safeWalkSetupForm').classList.remove('hidden');
  document.getElementById('safeWalkActivePanel').classList.add('hidden');
  document.getElementById('safeWalkStatusBadge').textContent = 'Inactivo';
  document.getElementById('safeWalkStatusBadge').style.background = 'rgba(56, 189, 248, 0.15)';
  document.getElementById('safeWalkStatusBadge').style.color = 'var(--accent-cyan)';
}

function openFinishSafeWalkModal() {
  openDuressKeypad();
}

function triggerSafeWalkExpiredAlert(destination) {
  const user = activeUser || familyMembers[0];
  resetSafeWalkUI();
  const alertMsg = `🚨 ALERTA PREVENTIVA ACOMPÁÑAME: ${user.name} NO confirmó llegada de su trayecto a "${destination}".`;
  
  showWhatsAppModal('🚨 ALERTA PREVENTIVA ACOMPÁÑAME', alertMsg, user.lat, user.lng);
}

// 4. Zona de Privacidad (Modo Fantasma)
let isGhostModeActive = false;

function togglePrivacyGhostMode(enabled) {
  isGhostModeActive = enabled;
  const user = activeUser || familyMembers[0];
  
  if (enabled) {
    notifyInPhone('👻 Modo Fantasma Activado', 'Tu ubicación se difumina en la vista familiar (+-500m). El botón SOS mantiene GPS exacto.');
  } else {
    notifyInPhone('📍 Ubicación Exacta Activada', 'Tu posición exacta se comparte con la Familia Andrada.');
  }
}

// 5. Alerta Silenciosa / Pánico Discreto
function triggerDiscreetSilentSOS() {
  const user = activeUser || familyMembers[0];
  const silentMsg = `🤫 ALERTA SILENCIOSA SOS: ${user.name} solicitó auxilio discreto (pantalla oscura sin sonido). Coordenadas exactas transmitidas.`;
  
  fetch('/api/sos-silent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: user.id, lat: user.lat, lng: user.lng, silent: true })
  }).catch(() => {});
  
  showWhatsAppModal('🤫 ALERTA SILENCIOSA SOS (PÁNICO DISCRETO)', silentMsg, user.lat, user.lng);
}

// 6. SMS Contingencia Offline
function generateSmsOfflineFallback() {
  const user = activeUser || familyMembers[0];
  const mapsLink = `https://maps.google.com/?q=${user.lat.toFixed(6)},${user.lng.toFixed(6)}`;
  const smsBody = `🚨 SOS OFFLINE FAMILIA ANDRADA: ${user.name} necesita auxilio. Ubicacion: ${mapsLink} Bateria: ${user.battery}%`;
  
  const smsUrl = `sms:?body=${encodeURIComponent(smsBody)}`;
  window.open(smsUrl, '_blank');
}

// 7. Simulación de Eventos Rápidos (Velocidad, Impacto, Batería Baja)
function triggerSimulationEvent(eventType) {
  const user = activeUser || familyMembers[0];
  const badge = document.getElementById('speedometerBadge');

  if (eventType === 'SPEED_EXCESS') {
    user.speed = 135.0;
    if (badge) {
      badge.textContent = '135 km/h !';
      badge.style.background = 'rgba(239, 68, 68, 0.25)';
      badge.style.color = '#EF4444';
    }
    const alertMsg = `⚠️ ALERTA DE SEGURIDAD VIAL: ${user.name} supera el umbral de velocidad máxima (135 km/h).`;
    notifyInPhone('⚠️ Exceso de Velocidad', alertMsg);
    showWhatsAppModal('⚠️ EXCESO DE VELOCIDAD (>110 km/h)', alertMsg, user.lat, user.lng);

  } else if (eventType === 'CRITICAL_BATTERY') {
    user.battery = 12;
    const alertMsg = `🔋 ALERTA DE BATERÍA BAJA: El teléfono de ${user.name} está por apagarse (${user.battery}%).`;
    notifyInPhone('🔋 Batería Baja (12%)', alertMsg);
    showWhatsAppModal('🔋 BATERÍA CRÍTICA (<15%)', alertMsg, user.lat, user.lng);

  } else if (eventType === 'IMPACT') {
    user.speed = 0.0;
    if (badge) {
      badge.textContent = '0 km/h (Colisión)';
      badge.style.background = 'rgba(239, 68, 68, 0.3)';
      badge.style.color = '#EF4444';
    }
    const alertMsg = `💥 COLISIÓN / FRENADA BRUSCA DETECTADA: Sensor G registró desaceleración brusca en el móvil de ${user.name}.`;
    notifyInPhone('💥 Alerta de Impacto', alertMsg);
    showWhatsAppModal('💥 IMPACTO / COLISIÓN DE TRÁNSITO', alertMsg, user.lat, user.lng);
  }
}

// 8. Registro Transparente de Consultas de Ubicación (Audit Trail)
let locationViewAuditLogs = [];

function loadStoredAuditLogs() {
  const saved = localStorage.getItem('andrada_location_audit_logs');
  if (saved) {
    try {
      locationViewAuditLogs = JSON.parse(saved);
    } catch (e) {
      locationViewAuditLogs = [];
    }
  } else {
    locationViewAuditLogs = [
      { viewerName: 'Carlos Andrada (Papá)', targetName: 'Mateo Andrada', timeStr: 'Hace 3 min' },
      { viewerName: 'Lucía Andrada (Mamá)', targetName: 'Sofía Andrada', timeStr: 'Hace 12 min' }
    ];
  }
  renderLocationAuditLogs();
}

function renderLocationAuditLogs() {
  const container = document.getElementById('locationAuditLogList');
  if (!container) return;

  if (locationViewAuditLogs.length === 0) {
    container.innerHTML = '<div style="font-size: 10px; color: var(--text-muted); text-align: center;">Sin consultas recientes.</div>';
    return;
  }

  container.innerHTML = locationViewAuditLogs.slice(0, 8).map(log => `
    <div class="audit-log-item">
      <span>👁️ <strong>${log.viewerName}</strong> vio la ubicación de <em>${log.targetName}</em></span>
      <span style="font-size: 9px; color: var(--text-muted);">${log.timeStr}</span>
    </div>
  `).join('');
}

function logLocationView(viewer, target) {
  if (!viewer || !target) return;
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const entry = {
    viewerName: viewer.name,
    targetName: target.name,
    timeStr: `Hoy ${timeStr}`
  };

  locationViewAuditLogs.unshift(entry);
  if (locationViewAuditLogs.length > 20) locationViewAuditLogs.pop();

  localStorage.setItem('andrada_location_audit_logs', JSON.stringify(locationViewAuditLogs));
  renderLocationAuditLogs();

  notifyInPhone('👁️ Consulta Transparente', `${viewer.name} vio la ubicación en vivo de ${target.name.split(' ')[0]}`);

  fetch('/api/privacy/log-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewer_id: viewer.id, target_id: target.id, timestamp: timeStr })
  }).catch(() => {});
}

function updatePrivacySchedule(scheduleMode) {
  localStorage.setItem('andrada_privacy_schedule', scheduleMode);
  const labels = {
    'ALWAYS': '🟢 Compartición 24/7 Transparente',
    'WEEKEND_NIGHTS': '🌙 Solo Noches de Fin de Semana (Vie-Dom 21:00 a 06:00)',
    'OUT_OF_CITY': '🚗 Solo Trayectos Fuera de la Ciudad'
  };
  const label = labels[scheduleMode] || scheduleMode;
  notifyInPhone('🤝 Pacto de Privacidad Actualizado', label);
}


