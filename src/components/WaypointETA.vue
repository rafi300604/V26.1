<template>
  <div v-if="showETA" class="waypoint-eta-panel">
    <!-- Header sederhana -->
    <div class="eta-header">
      <div class="header-title">Waypoint ETA</div>
      <button @click="$emit('toggle-eta')" class="close-btn" title="Tutup panel">
        ×
      </button>
    </div>

    <!-- Konten utama -->
    <div class="eta-content">
      <div v-if="!selectedShip" class="no-data">
        Pilih kapal terlebih dahulu
      </div>

      <div v-else-if="waypointSummary.length === 0" class="no-data">
        Belum ada waypoint
      </div>

      <div v-else class="waypoint-list">
        <div
          v-for="(waypoint, index) in waypointSummary"
          :key="index"
          class="waypoint-item"
        >
          <button @click="$emit('remove-waypoint', index)" class="delete-waypoint-btn" title="Hapus waypoint">
            ×
          </button>

          <div class="waypoint-header">
            <div class="waypoint-number">{{ index + 1 }}</div>
          </div>

          <div class="waypoint-info">
            <div class="waypoint-name">{{ waypoint.name }}</div>
            <div class="waypoint-details">
              <div class="detail-row">
                <span class="detail-label">Jarak:</span>
                <span class="detail-value">{{ waypoint.distance }} NM</span>
              </div>
              <div v-if="waypoint.eta" class="detail-row">
                <span class="detail-label">ETA:</span>
                <span class="detail-value">{{ waypoint.eta }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary ringkas -->
        <div class="summary-section">
          <div class="summary-row">
            <span class="summary-label">Total Jarak:</span>
            <span class="summary-value">{{ totalDistance }} NM</span>
          </div>
          <div v-if="totalTime" class="summary-row">
            <span class="summary-label">Total Waktu:</span>
            <span class="summary-value">{{ totalTime }}</span>
          </div>
          <div v-if="arrivalTime" class="summary-row">
            <span class="summary-label">Waktu Tiba:</span>
            <span class="summary-value">{{ arrivalTime }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ETA",
  props: {
    showETA: {
      type: Boolean,
      default: false
    },
    selectedShip: {
      type: Object,
      default: null
    },
    waypointSummary: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    totalDistance() {
      if (!this.waypointSummary.length) return null;
      const total = this.waypointSummary.reduce((sum, wp) => {
        return sum + (parseFloat(wp.distance) || 0);
      }, 0);
      return total.toFixed(2);
    },
    totalTime() {
      if (!this.waypointSummary.length) return null;
      let totalHours = 0;
      this.waypointSummary.forEach(wp => {
        if (wp.speed > 0) {
          totalHours += parseFloat(wp.distance) / wp.speed;
        }
      });
      return this.formatDuration(totalHours);
    },
    arrivalTime() {
      if (!this.waypointSummary.length) return null;
      const now = new Date();
      let totalHours = 0;

      this.waypointSummary.forEach(wp => {
        if (wp.speed > 0) {
          totalHours += parseFloat(wp.distance) / wp.speed;
        }
      });

      const arrivalDate = new Date(now.getTime() + (totalHours * 60 * 60 * 1000));
      const year = arrivalDate.getFullYear();
      const month = String(arrivalDate.getMonth() + 1).padStart(2, '0');
      const day = String(arrivalDate.getDate()).padStart(2, '0');
      const hours = String(arrivalDate.getHours()).padStart(2, '0');
      const minutes = String(arrivalDate.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day} | ${hours}:${minutes}`;
    }
  },
  methods: {
    formatDuration(hours) {
      if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes} menit`;
      } else if (hours < 24) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}j ${m}m`;
      } else {
        const days = Math.floor(hours / 24);
        const remainingHours = Math.floor(hours % 24);
        return `${days}h ${remainingHours}j`;
      }
    }
  }
};
</script>

<style scoped>
.waypoint-eta-panel {
  position: absolute;
  bottom: 140px;
  right: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  max-width: 320px;
  max-height: 50vh;
  z-index: 1000;
  overflow: hidden;
  border: 1px solid #e3e3e3;
}

.eta-header {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  padding: 12px 16px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.eta-content {
  padding: 0;
  max-height: calc(50vh - 60px);
  overflow-y: auto;
}

.no-data {
  padding: 24px 16px;
  text-align: center;
  color: #666;
  font-style: italic;
  font-size: 0.9rem;
}

.waypoint-list {
  padding: 0;
}

.waypoint-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f3f4;
  transition: background-color 0.2s ease;
  position: relative;
}

.waypoint-item:hover {
  background-color: #f8f9fa;
}

.waypoint-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.waypoint-number {
  width: 24px;
  height: 24px;
  background: #1976d2;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8rem;
}

.delete-waypoint-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
  transition: all 0.2s ease;
  z-index: 10;
}

.delete-waypoint-btn:hover {
  background: #c82333;
  transform: scale(1.1);
}

.waypoint-info {
  flex: 1;
  min-width: 0;
}

.waypoint-name {
  font-weight: 600;
  color: #222;
  font-size: 0.95rem;
  margin-bottom: 6px;
  word-break: break-word;
}

.waypoint-details {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 0.8rem;
  color: #6c757d;
  font-weight: 500;
}

.detail-value {
  font-size: 0.8rem;
  color: #495057;
  font-weight: 500;
  text-align: right;
  font-family: 'Courier New', monospace;
}

.summary-section {
  background: #e3f2fd;
  padding: 12px 16px;
  border-top: 1px solid #bbdefb;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 0.85rem;
}

.summary-row:last-child {
  margin-bottom: 0;
}

.summary-label {
  color: #1976d2;
  font-weight: 500;
}

.summary-value {
  color: #1565c0;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

/* Scrollbar styling */
.eta-content::-webkit-scrollbar {
  width: 4px;
}

.eta-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.eta-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

.eta-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .waypoint-eta-panel {
    min-width: 260px;
    max-width: 300px;
    right: 16px;
  }

  .waypoint-item {
    padding: 10px 14px;
  }

  .summary-section {
    padding: 10px 14px;
  }
}
</style>