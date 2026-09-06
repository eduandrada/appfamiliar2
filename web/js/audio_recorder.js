// ==============================================================================
// FAMILIA ANDRADA - CAJA NEGRA EXPRÉS (GRABADOR DE 15 SEGUNDOS DE AUDIO)
// ==============================================================================

class BlackBoxAudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.analyser = null;
    this.canvas = document.getElementById('audioVisualizer');
    this.canvasCtx = this.canvas ? this.canvas.getContext('2d') : null;
    this.timerElement = document.getElementById('blackboxTimer');
    this.recordButton = document.getElementById('btnRecordAudio');
    this.audioPlayer = document.getElementById('audioPlayback');
    
    this.isRecording = false;
    this.secondsLeft = 15;
    this.intervalId = null;
    this.animationFrameId = null;

    this.initEvents();
  }

  initEvents() {
    if (this.recordButton) {
      this.recordButton.addEventListener('click', () => {
        if (!this.isRecording) {
          this.startRecording();
        } else {
          this.stopRecording();
        }
      });
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      // Configurar visualizador de ondas
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (this.audioPlayer) {
          this.audioPlayer.src = audioUrl;
          this.audioPlayer.classList.remove('hidden');
        }
        stream.getTracks().forEach(track => track.stop());
        this.simulateCloudUpload(audioBlob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordButton.classList.add('recording');
      this.recordButton.innerHTML = '<i class="fa-solid fa-stop"></i> Detener Grabación';

      this.secondsLeft = 15;
      this.updateTimerDisplay();

      this.intervalId = setInterval(() => {
        this.secondsLeft--;
        this.updateTimerDisplay();
        if (this.secondsLeft <= 0) {
          this.stopRecording();
        }
      }, 1000);

      this.drawWaveform();

    } catch (err) {
      console.warn('Acceso al micrófono no disponible o denegado, simulando audio sintético:', err);
      this.simulateSyntheticRecording();
    }
  }

  stopRecording() {
    if (this.isRecording) {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      clearInterval(this.intervalId);
      cancelAnimationFrame(this.animationFrameId);

      if (this.recordButton) {
        this.recordButton.classList.remove('recording');
        this.recordButton.innerHTML = '<i class="fa-solid fa-circle-dot"></i> Iniciar Grabación 15s';
      }
      this.secondsLeft = 15;
      this.updateTimerDisplay();
    }
  }

  updateTimerDisplay() {
    if (this.timerElement) {
      this.timerElement.textContent = `${this.secondsLeft}.0s`;
    }
  }

  drawWaveform() {
    if (!this.analyser || !this.canvasCtx) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);

      this.canvasCtx.fillStyle = 'rgba(7, 11, 20, 0.4)';
      this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const barWidth = (this.canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * this.canvas.height;
        this.canvasCtx.fillStyle = `rgb(239, ${Math.max(68, 255 - dataArray[i])}, 68)`;
        this.canvasCtx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }

  simulateSyntheticRecording() {
    this.isRecording = true;
    this.recordButton.classList.add('recording');
    this.recordButton.innerHTML = '<i class="fa-solid fa-stop"></i> Grabando (Simulación)';
    this.secondsLeft = 15;
    this.updateTimerDisplay();

    this.intervalId = setInterval(() => {
      this.secondsLeft--;
      this.updateTimerDisplay();
      if (this.secondsLeft <= 0) {
        this.stopRecording();
        alert('Caja Negra Exprés: 15s de audio ambiente simulados y transmitidos al servidor de la Familia Andrada.');
      }
    }, 1000);
  }

  simulateCloudUpload(blob) {
    console.log(`[Caja Negra] Subiendo paquete de audio (${blob.size} bytes) a S3 / MinIO...`);
    // Mock de subida
    setTimeout(() => {
      console.log('[Caja Negra] Audio de 15 segundos respaldado con éxito en la nube familiar.');
    }, 800);
  }
}

// Inicializar grabador al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  window.blackBoxAudio = new BlackBoxAudioRecorder();
});
