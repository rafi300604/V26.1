<template>
  <div v-if="show" class="summary-panel">
    <div class="summary-header">
      <div class="title">Summary Waypoint</div>
      <button class="close-btn" @click="$emit('close')" title="Tutup">×</button>
    </div>
    <div class="summary-content">
      <div v-if="summaries.length === 0" class="empty">Belum ada waypoint yang diinput.</div>
      <div v-else class="ship-list">
        <div class="ship-card" v-for="(s, sIdx) in summaries" :key="sIdx">
          <div class="ship-header">
            <div class="ship-title">
              <span class="label">Kapal</span>
              <button type="button" class="ship-link" @click="$emit('select-ship', s.id)" title="Pilih kapal ini">
                {{ s.shipName }}
              </button>
              <span class="chip chip-blue" aria-label="Serial Number">SN: {{ s.sn }}</span>
            </div>
            <div class="ship-meta"></div>
          </div>
          <table class="wp-table wp-table-modern" v-if="s.count > 0">
            <thead>
              <tr>
                <th class="th-id">No</th>
                <th>Waypoint</th>
                <th class="th-num">Jarak (NM)</th>
                <th class="th-eta">ETA</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(w, wIdx) in s.waypoints" :key="wIdx" :class="[{ odd: wIdx % 2 === 1 }]">
                <td class="cell-id">
                  <span class="id-badge">{{ wIdx + 1 }}</span>
                </td>
                <td>
                  <div class="wp-name">{{ w.name }}</div>
                </td>
                <td class="num">
                  <span class="chip chip-green">{{ w.distance }}</span>
                </td>
                <td>
                  <span :class="['eta-badge', etaColorClass(w.eta)]">{{ w.eta || '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="totals" v-if="s.count > 0">
            <div class="total-item">
              <span class="label">Total Jarak</span>
              <span class="chip chip-green">{{ s.totalDistance }} NM</span>
            </div>
            <div class="total-item">
              <span class="label">Total Waktu</span>
              <span class="chip chip-amber">{{ s.totalEtaText }}</span>
            </div>
            <div class="total-item">
              <span class="label">Perkiraan Tiba</span>
              <span class="chip chip-indigo">{{ s.arrivalAt }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SummaryWaypoint',
  props: {
    show: { type: Boolean, default: false },
    ships: { type: Array, default: () => [] },
    waypointsByShip: { type: Object, default: () => ({}) },
    defaultSpeed: { type: Number, default: 20 }
  },
  computed: {
    summaries() {
      const out = [];
      (this.ships || []).forEach(ship => {
        if (!ship || !ship.id) return;
        const store = this.waypointsByShip[ship.id];
        const list = (store && Array.isArray(store.list)) ? store.list : [];

        const shipLat = Number(ship.lat);
        const shipLng = Number(ship.lng);
        const speed = Number(ship.shipSpeed) || this.defaultSpeed;

        const waypoints = [];
        let totalDistance = 0;
        let totalHours = 0;

        list.forEach(wp => {
          const lat = Number(wp.lat);
          const lng = Number(wp.lng);
          if (isNaN(lat) || isNaN(lng) || isNaN(shipLat) || isNaN(shipLng)) return;

          const distanceNm = this.computeDistanceNm(shipLat, shipLng, lat, lng);
          totalDistance += distanceNm;
          let eta = null;
          let timeHours = 0;
          if (speed > 0) {
            timeHours = distanceNm / speed;
            totalHours += timeHours;
            eta = this.formatETA(timeHours);
          }
          waypoints.push({
            name: wp.name || '-',
            lat, lng,
            distance: distanceNm.toFixed(2),
            eta,
          });
        });

        if (waypoints.length > 0) {
          const arrivalAt = this.formatDateTime(new Date(Date.now() + totalHours * 3600 * 1000));
          out.push({
            id: ship.id,
            shipName: ship.name || '-',
            sn: ship.sn || '-',
            waypoints,
            count: waypoints.length,
            totalDistance: totalDistance.toFixed(2),
            totalEtaText: this.formatETA(totalHours),
            arrivalAt,
          });
        }
      });
      return out;
    }
  },
  methods: {
    etaColorClass(eta) {
      if (!eta) return 'eta-neutral';
      // Normalize Indonesian strings like "3j 20m", "45 menit", "2h 5j"
      const hMatch = /([0-9]+)\s*j/.exec(eta) || /([0-9]+)\s*h/.exec(eta);
      const mMatch = /([0-9]+)\s*m/.exec(eta) || /([0-9]+)\s*menit/.exec(eta);
      const hours = hMatch ? Number(hMatch[1]) : 0;
      const minutes = mMatch ? Number(mMatch[1]) : 0;
      const totalMinutes = hours * 60 + minutes;
      if (totalMinutes <= 30) return 'eta-good';
      if (totalMinutes <= 180) return 'eta-warn';
      return 'eta-bad';
    },
    computeDistanceNm(lat1, lng1, lat2, lng2) {
      const R = 6371; // km
      const toRad = deg => deg * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceKm = R * c;
      return distanceKm / 1.852; // to NM
    },
    formatETA(hours) {
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
    },
    formatDateTime(d) {
      try {
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        const ss = pad(d.getSeconds());
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
      } catch (e) {
        return '-';
      }
    }
  }
}
</script>

<style scoped>
.summary-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  border: 1px solid #cfe3ff;
  z-index: 1100;
  min-width: 620px;
  max-height: 60vh;
  overflow: hidden;
}
.summary-header {
  background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
  padding: 12px 16px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.summary-header .title { font-weight: 700; }
.close-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.close-btn:hover { background: rgba(255,255,255,0.3); }
.summary-content { padding: 12px 12px 16px; max-height: calc(60vh - 52px); overflow: auto; }
.empty { color: #444; padding: 8px; }
.ship-list { display: flex; flex-direction: column; gap: 12px; }
.wp-table { width: 100%; border-collapse: collapse; }
.wp-table thead th {
  text-align: left;
  font-weight: 700;
  color: #0d47a1;
  border-bottom: 2px solid #cfe3ff;
  padding: 8px;
  background: #e9f2ff;
  position: sticky; top: 0; z-index: 1;
}
.wp-table-modern { border-radius: 8px; overflow: hidden; }
.wp-table thead .th-id { width: 56px; }
.wp-table thead .th-num { width: 120px; }
.wp-table thead .th-eta { width: 140px; }
.wp-table tbody td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
.wp-table tbody tr.odd td { background: #fcfdff; }
.wp-table .num { font-family: 'Courier New', monospace; color: #1976d2; font-weight: 600; }
.wp-name { font-weight: 600; color: #111; }
.cell-id { text-align: center; }
.id-badge { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 999px; font-weight: 800; font-size: 12px; color: #0d47a1; background: #e9f2ff; border: 1px solid #cfe3ff; }
.black-text { color: #000; }

/* Chips & badges */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.chip-blue { background: #e6f0ff; color: #0d47a1; border: 1px solid #cfe3ff; }
.chip-slate { background: #eef2f7; color: #425466; border: 1px solid #e2e8f0; }
.chip-green { background: #e6f7ee; color: #1b7f3f; border: 1px solid #b7e3c7; }
.chip-amber { background: #fff7e6; color: #8a6200; border: 1px solid #ffe1a6; }
.chip-indigo { background: #eef0ff; color: #3f51b5; border: 1px solid #d6dcff; }

.eta-badge { display: inline-flex; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 13px; }
.eta-neutral { background: #f3f4f6; color: #111827; border: 1px solid #e5e7eb; }
.eta-good { background: #e6f7ee; color: #1b7f3f; border: 1px solid #b7e3c7; }
.eta-warn { background: #fff7e6; color: #8a6200; border: 1px solid #ffe1a6; }
.eta-bad { background: #fde8e8; color: #9b1c1c; border: 1px solid #f8c7c7; }

.ship-card {
  border: 1px solid #cfe3ff;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow .2s ease;
}
.ship-card:hover { box-shadow: 0 6px 24px rgba(13,71,161,0.12); }
.ship-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e9f2ff;
  border-bottom: 1px solid #cfe3ff;
  padding: 10px 12px;
}
.ship-title { color: #0d47a1; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.ship-meta { color: #245aa3; font-weight: 600; }
.ship-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0 4px;
  color: #0d47a1;
  font-weight: 800;
  text-decoration: underline;
  cursor: pointer;
}
.ship-link:hover { text-decoration: none; }
.label { font-size: 12px; color: #245aa3; font-weight: 600; margin-right: 2px; }
.totals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  background: #f5faff;
  border-top: 1px solid #cfe3ff;
  padding: 10px 12px;
}
.total-item { color: #0d47a1; display: flex; align-items: center; gap: 8px; }
.totals .label { font-size: 12px; color: #245aa3; font-weight: 600; }
.totals .chip { font-size: 13px; padding: 4px 10px; }
</style>
