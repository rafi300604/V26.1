<template>
  <div class="sos-root">
    <!-- Floating SOS button at bottom-right -->
    <button class="sos-btn" :class="{ active: indicatorActive, blinking: indicatorBlink }" @click="togglePanel" title="SOS">
      <span class="sos-label">SOS</span>
      <span class="sos-indicator" :class="{ on: indicatorActive }"></span>
    </button>

    <!-- Slide-up panel -->
    <div v-if="showPanel" class="sos-panel" role="dialog" aria-label="Panel SOS">
      <div class="sos-panel-header">
        <div class="sos-panel-title">
          <svg class="title-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l9 4v6c0 5-3.8 9.7-9 10-5.2-.3-9-5-9-10V6l9-4zm0 3.2L6 7.3v4.7c0 3.9 2.9 7.5 6 7.7 3.1-.2 6-3.8 6-7.7V7.3l-6-2.1zM11 8h2v5h-2V8zm0 6h2v2h-2v-2z"/></svg>
          SOS Panel
        </div>
        <div class="status-pill" :class="{ active: indicatorActive }">
          <span class="dot"></span>{{ indicatorActive ? 'Alarm Aktif' : 'Siaga' }}
        </div>
        <button class="sos-close" @click="showPanel=false" aria-label="Tutup">×</button>
      </div>

      <div class="sos-body">
        <!-- Alarm controls -->
        <div class="sos-controls" aria-label="Kontrol Alarm">
          <button class="sos-test" @click="testAlarm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h2v4H3v-4zm4-5h2v14H7V5zm4 3h2v8h-2V8zm4-2h2v12h-2V6zm4 4h2v4h-2v-4z"/></svg>
            Test Suara
          </button>
          <button class="sos-stop" @click="stopAlarm" :disabled="!indicatorActive">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
            Hentikan Alarm
          </button>
        </div>

        <!-- Admin post form -->
        <div v-if="mode==='admin'" class="sos-admin-form" aria-label="Form Kirim SOS">
          <div class="form-row">
            <label class="label">Pilih Kapal</label>
            <select v-model="postTargetSn" class="select">
              <option disabled value="">— pilih kapal —</option>
              <option v-for="s in ships" :key="s.id" :value="s.sn">
                {{ s.name }} ({{ s.sn }})
              </option>
            </select>
          </div>
          <div class="form-row small">Lokasi diambil otomatis dari posisi kapal saat ini.</div>
          <div class="form-actions">
            <button class="sos-send" :disabled="!canSend" @click="sendSOS">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
              Kirim SOS
            </button>
          </div>
        </div>

        <!-- Recent payloads -->
        <div class="sos-events">
          <div class="section-title">Terakhir Diterima</div>
          <div v-if="recent.length===0" class="empty">Belum ada sinyal SOS.</div>
          <ul v-else class="events-list">
            <li v-for="(ev, idx) in recent" :key="idx" class="event-item">
              <div class="badge">SOS</div>
              <div class="kv"><span>SN</span><strong>{{ ev.device_sn || ev.sn }}</strong></div>
              <div class="kv"><span>Kapal</span><strong>{{ ev.shipName || '-' }}</strong></div>
              <div class="kv"><span>Waktu</span><strong>{{ formatTime(ev.timestamp) }}</strong></div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SOS',
  props: {
    mode: { type: String, default: 'user' }, // 'admin' | 'user'
    ships: { type: Array, default: () => [] },
    selectedShip: { type: Object, default: null },
    // For user mode, limit which SNs can trigger the alarm
    allowedSns: { type: Array, default: () => [] },
  },
  data() {
    return {
      showPanel: false,
      es: null,
      indicatorActive: false,
      indicatorBlink: false,
      recent: [], // { device_sn, shipName, timestamp, raw }
      postTargetSn: '',
      audioCtx: null,
      alarmNode: null,
      alarmTimer: null,
      lastBlinkTimer: null,
    };
  },
  computed: {
    canSend() {
      if (this.mode !== 'admin') return false;
      return !!this.postTargetSn && !!this.findShipBySn(this.postTargetSn);
    }
  },
  mounted() {
    // Default target SN = currently selected ship if available
    if (this.selectedShip && this.selectedShip.sn) {
      this.postTargetSn = this.selectedShip.sn;
    }
    this.openSSE();
  },
  beforeUnmount() {
    this.closeSSE();
    this.stopAlarm();
    if (this.lastBlinkTimer) { clearTimeout(this.lastBlinkTimer); this.lastBlinkTimer = null; }
  },
  methods: {
    togglePanel() {
      this.showPanel = !this.showPanel;
      // Creating AudioContext on a user gesture improves autoplay success
      if (!this.audioCtx) {
        try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
      }
    },
    openSSE() {
      try {
        this.closeSSE();
        const url = 'https://bcknd.fly.dev/api/v1/sse/sos';
        const es = new EventSource(url, { withCredentials: true });
        es.onmessage = (evt) => {
          this.handleIncoming(evt);
        };
        es.onerror = () => {
          // Auto-retry in a few seconds
          this.closeSSE();
          setTimeout(() => this.openSSE(), 5000);
        };
        this.es = es;
      } catch (e) {
        console.warn('SSE init failed:', e);
      }
    },
    closeSSE() {
      try { if (this.es) this.es.close(); } catch (_) {}
      this.es = null;
    },
    handleIncoming(evt) {
      let parsed = null;
      try {
        const raw = evt && evt.data ? evt.data : null;
        parsed = raw ? JSON.parse(raw) : null;
      } catch (_) { return; }
      if (!parsed) return;

      // New format uses { eventType, data }
      const type = (parsed.eventType || parsed.type || '').toString().toLowerCase();
      if (type === 'heartbeat') {
        // keep connection alive, ignore
        return;
      }

      let payload = parsed;
      if (type === 'sos' && parsed.data) payload = parsed.data;

      const device_sn = payload.device_sn || payload.sn || payload.deviceSn || '';
      const timestamp = payload.sent_at || payload.timestamp || payload.time || new Date().toISOString();

      if (!device_sn) return; // nothing to do without an SN

      // For user mode, ignore events not in allowed list if provided
      if (this.mode === 'user' && Array.isArray(this.allowedSns) && this.allowedSns.length > 0) {
        const set = new Set(this.allowedSns.map(v => v.toString()));
        if (!set.has(String(device_sn))) return;
      }

      const ship = this.findShipBySn(device_sn);
      const entry = { device_sn, timestamp, shipName: ship ? ship.name : undefined, raw: payload };
      this.recent.unshift(entry);
      if (this.recent.length > 10) this.recent.pop();

      this.triggerAlarm();
    },
    findShipBySn(sn) {
      if (!sn) return null;
      const s = this.ships.find((it) => String(it.sn) === String(sn) || String(it.deviceSn) === String(sn));
      return s || null;
    },
    async sendSOS() {
      if (!this.canSend) return;
      const ship = this.findShipBySn(this.postTargetSn);
      if (!ship) return;
      const payload = {
        device_sn: String(ship.sn || ship.deviceSn || ''),
        latitude: String(ship.lat),
        longitude: String(ship.lng),
        timestamp: new Date().toISOString(),
      };
      try {
        const resp = await fetch('https://bcknd.fly.dev/api/v1/sos/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const msg = await resp.text().catch(() => resp.statusText);
          alert('Gagal kirim SOS: ' + (msg || resp.status));
          return;
        }
        this.$emit('post-sent', payload);
        // Tidak lagi menambahkan manual ke daftar; menunggu SSE resmi dari server.
      } catch (e) {
        alert('Gagal kirim SOS: ' + (e && e.message ? e.message : String(e)));
      }
    },
    triggerAlarm() {
      this.indicatorActive = true;
      this.indicatorBlink = true;
      // Auto stop blinking after 12s
      if (this.lastBlinkTimer) clearTimeout(this.lastBlinkTimer);
      this.lastBlinkTimer = setTimeout(() => { this.indicatorBlink = false; }, 12000);
      this.playAlarm();
    },
    testAlarm() {
      this.playAlarm();
    },
    stopAlarm() {
      this.indicatorActive = false;
      this.indicatorBlink = false;
      if (this.lastBlinkTimer) { clearTimeout(this.lastBlinkTimer); this.lastBlinkTimer = null; }
      if (this.alarmTimer) { clearInterval(this.alarmTimer); this.alarmTimer = null; }
      try { if (this.alarmNode) { this.alarmNode.stop(0); this.alarmNode.disconnect(); } } catch (_) {}
      this.alarmNode = null;
    },
    playAlarm() {
      // Replace previous buzz with an ambulance-like siren:
      // Continuous sine wave sweeping between two frequencies (e.g. 650Hz and 950Hz)
      // with smooth ramps to emulate a classic emergency vehicle siren.
      try {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        // Clean previous
        if (this.alarmTimer) { clearInterval(this.alarmTimer); this.alarmTimer = null; }
        try { if (this.alarmNode) { this.alarmNode.stop(); this.alarmNode.disconnect(); } } catch (_) {}
        this.alarmNode = null;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; // smoother siren
        // Initial settings
        const lowF = 650;
        const highF = 950;
        const cycleSeconds = 2.0; // up 1s, down 1s
        const startTime = ctx.currentTime;
        osc.frequency.setValueAtTime(lowF, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.6, startTime + 0.25); // fade in
        osc.connect(gain).connect(ctx.destination);
        osc.start(startTime);
        this.alarmNode = osc;

        // Scheduling function for repeated sweep
        const scheduleSweep = () => {
          const t = ctx.currentTime;
          osc.frequency.cancelScheduledValues(t);
          // Up sweep
          osc.frequency.setValueAtTime(lowF, t);
          osc.frequency.linearRampToValueAtTime(highF, t + cycleSeconds / 2);
          // Down sweep
          osc.frequency.linearRampToValueAtTime(lowF, t + cycleSeconds);
        };
        scheduleSweep();
        this.alarmTimer = setInterval(scheduleSweep, cycleSeconds * 1000);

        this.indicatorActive = true;
        this.indicatorBlink = true;
      } catch (e) {
        console.warn('Unable to play siren:', e);
      }
    },
    formatTime(ts) {
      try {
        const d = new Date(ts);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      } catch (_) { return String(ts || ''); }
    },
  }
};
</script>

<style scoped>
 .sos-root {
   /* Gunakan fixed agar menempel pada layar browser, bukan container peta */
   position: fixed;
   /* Atur jarak dari kanan */
   right: 20px;
   /* Atur jarak dari bawah (sesuaikan agar pas di dalam kotak rectangle) */
   bottom: 20px;
   /* Pastikan tombol berada di atas elemen lain (seperti peta/copyright) */
   z-index: 2000;
   font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji;
 }
.sos-btn {
  position: relative;
  min-width: 84px;
  height: 44px;
  border-radius: 22px;
  border: none;
  padding: 0 18px 0 16px;
  background: linear-gradient(180deg, #ff6b6b, #d64545);
  color: #fff;
  font-weight: 800;
  letter-spacing: .5px;
  box-shadow: 0 8px 24px rgba(227, 49, 49, .35);
  cursor: pointer;
}
.sos-btn .sos-label { font-size: 14px; }
.sos-btn .sos-indicator {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #cc2525; /* red when off */
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.45);
}
.sos-btn.active .sos-indicator.on { background: #2ecc71; }
.sos-btn.blinking .sos-indicator { animation: blink 0.75s linear infinite; }
@keyframes blink { 0%, 100% { opacity: .35 } 50% { opacity: 1 } }

.sos-panel {
  position: absolute;
  right: 0;
  bottom: 56px;
  width: 320px;
  max-height: 56vh;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 14px 32px rgba(0,0,0,.18);
  overflow: hidden;
}
.sos-panel-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 12px 14px; background: linear-gradient(180deg, #f8fafc, #f1f5f9); border-bottom: 1px solid #e5e7eb; }
.sos-panel-title { font-weight: 800; color: #111827; display: flex; align-items: center; gap: 8px; }
.sos-panel-title .title-icon { color: #ef4444; }
.status-pill { justify-self: center; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
.status-pill .dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; box-shadow: inset 0 0 0 2px #fff; }
.status-pill.active { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.status-pill.active .dot { background: #10b981; }
.sos-close { background: none; border: none; font-size: 20px; line-height: 20px; cursor: pointer; color: #6b7280; }

.sos-body { padding: 6px 0 10px 0; }
.sos-controls { display: flex; gap: 8px; padding: 10px 14px; }
.sos-test, .sos-stop, .sos-send { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #111827; font-weight: 600; }
.sos-test svg, .sos-stop svg, .sos-send svg { opacity: .8; }
.sos-test:hover, .sos-stop:hover, .sos-send:not(:disabled):hover { background: #f9fafb; }
.sos-stop:disabled, .sos-send:disabled { opacity: .5; cursor: not-allowed; }

.sos-admin-form { padding: 8px 14px 14px 14px; border-top: 1px dashed #eef2f7; }
.form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.form-row .label { font-weight: 700; color: #111827; font-size: 12px; }
.form-row .select { height: 38px; border-radius: 10px; border: 1px solid #d1d5db; padding: 0 10px; background: #fff; color: #111827; }
.form-row.small { color: #6b7280; font-size: 12px; }
.form-row select { height: 38px; border-radius: 10px; border: 1px solid #d1d5db; padding: 0 10px; }
.form-actions { display: flex; justify-content: flex-end; }

.sos-events { padding: 8px 14px 14px 14px; border-top: 1px solid #f1f5f9; }
.section-title { font-weight: 800; margin-bottom: 8px; color: #0f172a; letter-spacing: .2px; }
.empty { color: #6b7280; font-size: 14px; }
.events-list { list-style: none; padding: 0 0 32px 0; margin: 0; display: flex; flex-direction: column; gap: 10px; max-height: 28vh; overflow: auto; }
.event-item { position: relative; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px 12px 12px 12px; background: #ffffff; box-shadow: 0 1px 0 rgba(0,0,0,.04); }
.event-item .badge { position: absolute; left: 16px; top: -6px; background: #ef4444; color: #fff; font-weight: 800; font-size: 11px; border-radius: 999px; padding: 4px 12px; letter-spacing: .4px; box-shadow: 0 6px 12px rgba(239,68,68,.25); }
.event-item .kv { display: grid; grid-template-columns: 72px 1fr; align-items: center; font-size: 13px; color: #374151; }
.event-item .kv span { color: #6b7280; }
.event-item .kv strong { color: #111827; font-weight: 700; }
</style>
