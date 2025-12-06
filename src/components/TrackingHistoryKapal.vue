<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-content">
  <h3 class="tracking-title">Tracking History Kapal</h3>
  <p class="tracking-sn"><strong>{{ vesselNameDisplay }}</strong></p>

      <div class="modal-row">
        <label>Pilih rentang waktu: </label>
        <input type="number" v-model.number="days" min="1" max="30" />
      </div>

      <div class="modal-actions">
        <button class="cancel-btn" @click="close" :disabled="loading">Batal</button>
        <button class="save-btn" @click="fetchHistory" :disabled="loading" :aria-busy="loading ? 'true' : 'false'">
          <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
          {{ loading ? 'Mengambil data…' : 'Fetch' }}
        </button>
      </div>

      <div v-if="error" class="error-text">{{ error }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TrackingHistoryKapal',
  props: {
    show: { type: Boolean, default: false },
    sn: { type: String, default: '' },
    vesselId: { type: String, default: '' },
    vesselName: { type: String, default: '' },
    initialDays: { type: Number, default: 1 }
  },
  data() {
    return {
      days: 1,
      loading: false,
      error: null,
    };
  },
  computed: {
    // Display name: prefer explicit vesselName; fallback to sn
    vesselNameDisplay() {
      return (this.vesselName || this.sn || '').trim();
    },
    // Effective identifier used for API path (expects 32-char string)
    effectiveVesselId() {
      return (this.vesselId || '').trim();
    }
  },
  watch: {
    show(val) {
      if (val) {
        this.days = this.initialDays && this.initialDays > 0 ? this.initialDays : 1;
      }
    },
    initialDays(val) {
      if (!this.show) return;
      if (typeof val === 'number' && val > 0) {
        this.days = val;
      }
    }
  },
  methods: {
    close() {
      this.error = null;
      this.$emit('close');
    },
    async fetchHistory() {
      // Require a valid vessel_id (32 chars). We do not change the data fetching method,
      // only ensure the correct identifier is used.
      const vid = this.effectiveVesselId;
      if (!vid) {
        this.error = 'Vessel ID tidak tersedia';
        return;
      }
      if (vid.length !== 32) {
        this.error = 'Vessel ID harus 32 karakter';
        return;
      }
      if (!this.days || this.days < 1 || this.days > 30) {
        this.error = 'Rentang hari antara 1 sampai 30 hari';
        return;
      }

      this.loading = true;
      this.error = null;
      try {
        const url = `https://bcknd.fly.dev/api/v1/vessel/history/${encodeURIComponent(vid)}/feature-collections?days=${this.days}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include' // include cookies/session like other requests
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
        }
        const data = await res.json();

        // Normalize: prefer explicit FeatureCollection objects under data.history or data
        let normalized = data;
        if (data && typeof data === 'object') {
          if (data.data && data.data.history && data.data.history.type === 'FeatureCollection') {
            normalized = data.data.history;
          } else if (data.data && data.data.type === 'FeatureCollection') {
            normalized = data.data;
          }
        }

        // Emit normalized geojson/feature-collections to parent
        this.$emit('fetch-history', { vesselId: vid, sn: this.sn, days: this.days, data: normalized });
        this.close();
      } catch (err) {
        this.error = 'Gagal mengambil history: ' + err.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  min-width: 360px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.tracking-title { color: #000; margin-bottom: 6px; }
.tracking-sn { color: #000; margin: 0 0 12px 0; }
.modal-row { color: #000; margin: 12px 0; }
.modal-actions { display:flex; gap:8px; justify-content:flex-end; }
.cancel-btn { color: #000;background:#f1f1f1; border:none; padding:8px 12px; border-radius:8px; }
.save-btn { background:#1976d2; color:#fff; border:none; padding:8px 12px; border-radius:8px; display:flex; align-items:center; gap:8px; }
.save-btn:disabled { opacity: .8; cursor: not-allowed; }
.btn-spinner { width:16px; height:16px; border:2px solid #fff; border-top-color: transparent; border-radius:50%; animation:spin 1s linear infinite; }
.error-text { color:#c82333; margin-top:8px; }
@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
</style>
