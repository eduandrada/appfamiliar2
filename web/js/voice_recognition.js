// voice_recognition.js
// Handles voice guide toggle, SpeechRecognition (Web Speech API) and fallback to Google Speech API.

let recognition = null;
let isVoiceActive = false;

function toggleVoiceGuide() {
  if (isVoiceActive) {
    stopVoiceGuide();
  } else {
    startVoiceGuide();
  }
}

function startVoiceGuide() {
  // Play start sound
  new Audio('audio/ding.mp3').play();
  // Try Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      processVoiceResult(transcript);
    };
    recognition.onerror = (event) => {
      console.warn('[Voice] SpeechRecognition error:', event.error);
      // Fallback to Google Speech API
      fallbackToGoogleSpeech();
    };
    recognition.onend = () => {
      // keep listening until user stops
      if (isVoiceActive) {
        recognition.start();
      }
    };
    recognition.start();
    isVoiceActive = true;
    // UI feedback
    document.getElementById('voiceSpeechBar').classList.remove('hidden');
  } else {
    // No Web Speech support, fallback immediately
    fallbackToGoogleSpeech();
  }
}

function stopVoiceGuide() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  isVoiceActive = false;
  document.getElementById('voiceSpeechBar').classList.add('hidden');
  // Play stop sound (reuse same ding for simplicity)
  new Audio('audio/ding.mp3').play();
}

function processVoiceResult(transcript) {
  // Show the transcribed text in the voice bar
  const textElem = document.getElementById('voiceSpeechText');
  if (textElem) textElem.textContent = transcript;
  // Send to AI assistant automatically
  if (window.sendMessageToGemini) {
    window.sendMessageToGemini(transcript);
  }
}

async function fallbackToGoogleSpeech() {
  // Simple placeholder using fetch to Google Speech API – requires GOOGLE_SPEECH_API_KEY env.
  const apiKey = window.GOOGLE_SPEECH_API_KEY || (typeof process !== 'undefined' && process.env && process.env.GOOGLE_SPEECH_API_KEY) || '';
  if (!apiKey) {
    console.error('[Voice] No Google Speech API key provided for fallback.');
    return;
  }
  // Record short audio using MediaRecorder (not implemented fully for brevity).
  // In a real implementation, you'd capture audio stream, convert to FLAC/base64, and POST.
  console.warn('[Voice] Fallback to Google Speech API not fully implemented in this demo.');
}

// Expose to global scope for HTML onclick handlers
window.toggleVoiceGuide = toggleVoiceGuide;
window.startVoiceGuide = startVoiceGuide;
window.stopVoiceGuide = stopVoiceGuide;
