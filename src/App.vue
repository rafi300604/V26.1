<template>
  <div v-if="!isAuthenticated">
    <LoginPage @login-success="handleLoginSuccess" />
  </div>
  <div v-else>
    <AppAdmin v-if="isAdmin" :vm="this" />
    <AppUser v-else :vm="this" />
  </div>
</template>

<script>
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import kapalIcon from "./assets/kapal.png";
import kapalMapIcon from "./assets/kapal-maps.png";
import redFlagIcon from "./assets/red-flag.png";
import flagIcon from "./assets/flag.png";
import historyImg from "./assets/history.jpeg";
import LoginPage from "./components/LoginPage.vue";
import Waypoint from "./components/Waypoint.vue";
import WaypointETA from "./components/WaypointETA.vue";
import TrackingHistoryKapal from "./components/TrackingHistoryKapal.vue";
import SummaryWaypoint from "./components/SummaryWaypoint.vue";
import AdminUsersPage from "./components/AdminUsersPage.vue";
import KmlKmzUpload from "./components/KmlKmzUpload.vue";
import { authClient } from "./auth-client";
import JsonExcel from 'vue-json-excel3';
import AppAdmin from './AppAdmin.vue';
import AppUser from './AppUser.vue';

export default {
  name: "App",
  components: {
    LoginPage,
  Waypoint,
  WaypointETA,
    TrackingHistoryKapal,
    SummaryWaypoint,
    AdminUsersPage,
    DownloadExcel: JsonExcel,
    KmlKmzUpload,
    AppAdmin,
    AppUser,
  },
  data() {
    return {
      isAuthenticated: false,
      user: null,
      adminTab: 'home',
      map: null,
        kapalIconUrl: kapalIcon,
      search: "",
      searchBy: "name",
      selectedShip: null,
      selectedShipTrigger: 0, // Trigger untuk memaksa reactivity update
      ships: [],
  lastSuccessfulActiveDate: null,
      loadingShips: true,
      shipsError: null,
      markers: [],
      showWaypointModal: false,
      showWaypointETA: false,
      waypointMarkers: [],
      waypointList: [],
      waypointsByShip: {},
      routeLines: [],
      shipSpeed: 37,
      waypointSummary: [],
  showSummaryWaypoint: false,
      // Tracking/history per ship: { [shipId]: { markers: [], lines: [] } }
      trackingByShip: {},
  trackingInfoByShip: {},
  trackingDaysByShip: {},
  trackingExportRowsByShip: {},
      showTrackingHistory: false,
      trackingActiveShipId: null,
      trackingInfo: null,
      trackingSliderEnabled: false,
      trackingSliderIndex: 0,
      trackingSliderMax: 0,
      trackingCurrentTime: null,
      trackingCurrentCount: 0,
      // Autoplay state for tracking slider
      trackingAutoPlaying: false,
      trackingPlaybackComplete: false,
      trackingAutoTimer: null,
      // Auto refresh ships positions
      autoRefreshTimer: null,
      autoRefreshIntervalMs: 60_000,
      // Internal flag to avoid auto-zoom when refreshing ships
      isRefreshingShips: false,
      // Keep full polyline visible even when slider is enabled (used after autoplay)
      trackingFullLinePinned: false,
      // Waypoint outbox for retrying failed POSTs
      waypointOutboxTimer: null,
      waypointOutboxIntervalMs: 30000,
      // Tracking export
      trackingExportRows: [],
      trackingExportFields: {
        'Rentang Hari': 'rangeDays',
        'Nama Kapal': 'vesselName',
        'SN Kapal': 'vesselSn',
        'Waktu (DB)': 'timestamp',
        'Latitude': 'lat',
        'Longitude': 'lng',
        'Kecepatan (knots)': 'speed',
        'Arah (deg)': 'direction',
      },
      globalKmlKmzError: null,
      globalKmlKmzErrorTimer: null,
      globalKmlKmzSuccess: null,
      globalKmlKmzSuccessTimer: null,
      // Optional proxy for KML NetworkLink CORS bypass
      kmlProxyUrl: (import.meta && import.meta.env && import.meta.env.VITE_KML_PROXY_URL) ? import.meta.env.VITE_KML_PROXY_URL : '',
      // Resize handler reference (non-admin map sizing)
      _userResizeHandler: null,
    };
  },
  computed: {
    currentRole() {
      const source = this.user || {};
      const candidates = [
        source.role,
        source.metadata && source.metadata.role,
        source.user_metadata && source.user_metadata.role,
        source.claims && source.claims.role,
        Array.isArray(source.roles) ? source.roles[0] : null,
      ];
      const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
      return found ? found.toLowerCase() : '';
    },
    isAdmin() {
      const role = this.currentRole;
      if (!role) return false;
      const normalized = role.replace(/\s+/g, '_');
      return ['admin', 'super_admin', 'superadmin'].includes(normalized);
    },
    currentRoleLabel() {
      if (!this.currentRole) return 'User';
      return this.currentRole
        .split(/[_\s]+/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
    },
    currentUserName() {
      const source = this.user || {};
      return (
        source.name ||
        source.full_name ||
        source.fullName ||
        source.username ||
        source.email ||
        'Pengguna'
      );
    },
    filteredShips() {
      if (!this.search) return this.ships;
      const searchTerm = this.search.toLowerCase();
      return this.ships.filter(ship => {
        if (this.searchBy === 'name') {
          return ship.name.toLowerCase().includes(searchTerm);
        } else if (this.searchBy === 'sn') {
          return ship.sn.toLowerCase().includes(searchTerm);
        }
        return true;
      });
    },
    searchPlaceholder() {
      return this.searchBy === 'name' ? 'Cari nama kapal' : 'Cari SN (format 9xxxxx)';
    },
    trackingExportFileName() {
      const sn = (this.trackingInfo && this.trackingInfo.sn) || (this.selectedShip && this.selectedShip.sn) || 'kapal';
      const days = (this.trackingInfo && this.trackingInfo.days) || 'range';
      const dt = new Date();
      const pad = (n) => String(n).padStart(2,'0');
      const stamp = `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}`;
      return `analisa-tracking-${sn}-${days}hari-${stamp}.xls`;
    },
    shipExportFileName() {
      const dt = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}`;
      return `daftar-kapal-${stamp}.xls`;
    },
    shipExportFields() {
      return {
        name: 'name',
        position: 'position',
        last_transmitted_at: 'last_transmitted_at',
        power_source: 'power_source',
        heading: 'heading',
        speed: 'speed',
        data_source: 'data_source',
      };
    },
    shipExportRows() {
      const toSix = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return '';
        return n.toFixed(6);
      };
      const tsWithMs = (v) => {
        if (!v) return '';
        const base = this.formatTimestampToYMDHMS(v);
        return base ? `${base}.000` : '';
      };
      const rows = (this.filteredShips || []).map((s) => ({
        name: s.name || '',
        position: `(${toSix(s.lat)},${toSix(s.lng)})`,
        last_transmitted_at: tsWithMs(s.lastTransmittedAt || s.lastTransmittedAtDisplay || s.transmitDate),
        power_source: s.powerSource || '',
        heading: Number.isFinite(Number(s.heading)) ? Number(s.heading) : 0,
        speed: Number.isFinite(Number(s.shipSpeed)) ? Number(s.shipSpeed) : 0,
        data_source: s.dataSource || '',
      }));
      // Optional: sort by name A-Z to mirror UI screenshot
      rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return rows;
    },
    hasGlobalKmlKmzError() { return !!this.globalKmlKmzError; },
    hasGlobalKmlKmzSuccess() { return !!this.globalKmlKmzSuccess; },
  },
  async mounted() {
    try {
      // Check current session with Better Auth
      const session = await authClient.getSession();
      
      if (session.data) {
        this.isAuthenticated = true;
        this.user = session.data.user;
        this.adminTab = 'home';
        
        // Save to localStorage for UI state management
        localStorage.setItem('basarnas_auth', JSON.stringify({
          user: session.data.user,
          timestamp: Date.now()
        }));
        
        // Initialize map and fetch data for authenticated user
        this.$nextTick(() => {
          this.initializeMap();
          this.fetchShips();
          // Ensure map resizes correctly after layout stabilizes for non-admin
          this.$nextTick(() => {
            if (this.map) this.map.invalidateSize();
          });
          // Apply admin-equivalent map height for non-admin and keep in sync on resize
          this.applyUserGridHeight();
          this._userResizeHandler = () => this.applyUserGridHeight();
          window.addEventListener('resize', this._userResizeHandler, { passive: true });
          // Schedule periodic refresh of ship positions every minute
          this.autoRefreshTimer = setInterval(() => {
            this.refreshShipsPositions();
          }, this.autoRefreshIntervalMs);
          // Global listener: auto-close Waypoint ETA on any button click (except its own toggle)
          document.addEventListener('click', this.onGlobalButtonClick, false);
          // Start waypoint outbox flusher
          this.waypointOutboxTimer = setInterval(() => {
            this.flushWaypointOutbox();
          }, this.waypointOutboxIntervalMs);
          // Also try once on startup
          this.flushWaypointOutbox();
          // Initialize ship-list scroll state
          this.$nextTick(() => this.updateShipScrollState());
        });
      } else {
        // No valid session, clear any stale localStorage data
        localStorage.removeItem('basarnas_auth');
        this.adminTab = 'home';
      }
    } catch (error) {
      console.error('Session validation error:', error);
      // Clear localStorage on error
      localStorage.removeItem('basarnas_auth');
      this.adminTab = 'home';
    }
  },
  beforeUnmount() {
    // Clean up timers
    if (this.trackingAutoTimer) {
      clearInterval(this.trackingAutoTimer);
      this.trackingAutoTimer = null;
    }
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    // Remove global click listener
    document.removeEventListener('click', this.onGlobalButtonClick, false);
    if (this.waypointOutboxTimer) {
      clearInterval(this.waypointOutboxTimer);
      this.waypointOutboxTimer = null;
    }
    if (this._userResizeHandler) {
      window.removeEventListener('resize', this._userResizeHandler);
      this._userResizeHandler = null;
    }
  },
  watch: {
    filteredShips() {
      this.$nextTick(() => this.updateShipScrollState());
    },
  },
  methods: {
    handleSelectShipFromSummary(shipId) {
      if (!shipId) return;
      const ship = this.ships.find(s => s && s.id === shipId);
      if (ship) {
        this.showSummaryWaypoint = false;
        this.focusShip(ship);
      }
    },
    getTrackingDays(shipId) {
      if (!shipId) return 1;
      const val = this.trackingDaysByShip[shipId];
      return typeof val === 'number' && val > 0 ? val : 1;
    },
    // --- Ship list scroll controls ---
    onShipListHover(inside) {
      this.showShipScrollControls = !!inside;
      if (inside) this.updateShipScrollState();
    },
    onShipListScroll() {
      this.updateShipScrollState();
    },
    updateShipScrollState() {
      const root = this.$el || document;
      const el = root.querySelector('.ship-list');
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      this.canScrollUp = el.scrollTop > 0;
      this.canScrollDown = el.scrollTop < maxScroll - 1;
      // Auto-hide controls if not scrollable
      if (maxScroll <= 0) this.showShipScrollControls = false;
    },
    scrollShipListBy(dir) {
      const root = this.$el || document;
      const el = root.querySelector('.ship-list');
      if (!el) return;
      el.scrollBy({ top: dir * this.shipScrollStep, behavior: 'smooth' });
    },
    startShipAutoScroll(dir) {
      this.stopShipAutoScroll();
      this.shipAutoScrollTimer = setInterval(() => {
        const root = this.$el || document;
        const el = root.querySelector('.ship-list');
        if (!el) return this.stopShipAutoScroll();
        const before = el.scrollTop;
        el.scrollBy({ top: dir * 48, behavior: 'auto' });
        this.updateShipScrollState();
        const after = el.scrollTop;
        if (before === after || (dir < 0 && !this.canScrollUp) || (dir > 0 && !this.canScrollDown)) {
          this.stopShipAutoScroll();
        }
      }, 30);
    },
    stopShipAutoScroll() {
      if (this.shipAutoScrollTimer) {
        clearInterval(this.shipAutoScrollTimer);
        this.shipAutoScrollTimer = null;
      }
    },
    // ---- Waypoint persistence helpers ----
    formatLatForApi(lat) {
      const num = Number(lat);
      if (!isFinite(num)) return '0';
      if (num === 0) return '0';
      // up to 6 decimals is fine; API allows up to 20
      return num.toFixed(6);
    },
    formatLngForApi(lng) {
      const num = Number(lng);
      if (!isFinite(num)) return '0';
      if (num === 0) return '0';
      return num.toFixed(6);
    },
    normalizeVesselSn(sn) {
      const s = String(sn || '').trim();
      if (!s) return '';
      if (/^9[0-9]{5}$/.test(s)) return s;
      if (/^\d{6,15}$/.test(s)) return s;
      if (/^0-\d{7}$/.test(s)) return s;
      return s;
    },
    isValidDeviceSn(sn) {
      if (sn === null || sn === undefined) return false;
      return /^9[0-9]{5}$/.test(String(sn).trim());
    },
    truncateName24(name) {
      const s = String(name || '').trim();
      return s.length > 24 ? s.slice(0, 24) : s;
    },
    async postWaypointToApi({ vesselId, name, lat, lng }) {
      try {
        const payload = {
          vessel_id: (vesselId || '').toString().trim(),
          name: this.truncateName24(name),
          coordinate: {
            latitude: this.formatLatForApi(lat),
            longitude: this.formatLngForApi(lng)
          }
        };
        const resp = await fetch('https://bcknd.fly.dev/api/v1/waypoint/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          // Try to parse JSON error for friendly messages
          let serverMsg = '';
          try {
            const errJson = await resp.json();
            serverMsg = errJson?.message || errJson?.error || JSON.stringify(errJson);
          } catch (_) {
            serverMsg = await resp.text().catch(() => resp.statusText);
          }
          const err = new Error(serverMsg || 'Permintaan ditolak server');
          err.status = resp.status;
          err.payload = payload;
          throw err;
        }
        const data = await resp.json().catch(() => ({}));
        return { ok: true, data };
      } catch (e) {
        console.warn('Failed to POST waypoint:', e);
        // Build friendly message
        let reason = 'Gagal menyimpan waypoint.';
        const code = e?.status;
  if (code === 400) {
    reason = `Data tidak valid. Pastikan:
- vessel_id: ID kapal yang sah
- name: maksimal 24 karakter, tidak kosong
- latitude/longitude: string derajat desimal, 0 atau dengan titik (mis. -6.200000)`;
        } else if (code === 401) {
          reason = 'Tidak terautentikasi. Silakan login kembali.';
        } else if (code === 403) {
          reason = 'Tidak memiliki izin untuk menyimpan waypoint.';
        } else if (code === 404) {
          reason = 'Endpoint tidak ditemukan.';
        } else if (code >= 500) {
          reason = 'Server sedang bermasalah. Coba lagi nanti.';
        }
        const detail = e?.message ? `\n\nDetail: ${e.message}` : '';
        return { ok: false, error: new Error(reason + detail), status: code, payload: e?.payload };
      }
    },
    // Outbox helpers
    getWaypointOutbox() {
      try {
        const raw = localStorage.getItem('waypoint_outbox');
        return raw ? JSON.parse(raw) : [];
      } catch (_) { return []; }
    },
    saveWaypointOutbox(queue) {
      try { localStorage.setItem('waypoint_outbox', JSON.stringify(queue)); } catch (_) {}
    },
    queueWaypointPayload(payload) {
      const q = this.getWaypointOutbox();
      q.push(payload);
      this.saveWaypointOutbox(q);
    },
    async flushWaypointOutbox() {
      const q = this.getWaypointOutbox();
      if (!q || q.length === 0) return;
      const remaining = [];
      for (const payload of q) {
        try {
          const resp = await fetch('https://bcknd.fly.dev/api/v1/waypoint/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          if (!resp.ok) {
            // Keep in queue for later retry unless it's a 400 (invalid data)
            if (resp.status === 400) {
              console.warn('Dropping invalid waypoint from outbox:', payload);
            } else {
              remaining.push(payload);
            }
          } else {
            // Success; refresh the ship waypoints if this ship is visible
            const vesselId = payload.vessel_id || payload.vesselId;
            const ship = this.ships.find(s => s.id === vesselId);
            if (ship) this.fetchWaypointsForShipById(ship.id, ship.id);
          }
        } catch (err) {
          // Network or other failure: keep for retry
          remaining.push(payload);
        }
      }
      this.saveWaypointOutbox(remaining);
    },
  validateWaypointInput({ vesselId, name, lat, lng }) {
      const errors = [];
      const vessel = (vesselId || '').toString().trim();
      if (!vessel) {
        errors.push('Vessel ID wajib diisi.');
      }
      const nm = this.truncateName24(name);
      if (!nm || nm.length === 0) {
        errors.push('Nama waypoint wajib diisi.');
      }
      const la = Number(lat);
      const lo = Number(lng);
      if (!isFinite(la) || la < -90 || la > 90) {
        errors.push('Latitude harus antara -90 hingga 90.');
      }
      if (!isFinite(lo) || lo < -180 || lo > 180) {
        errors.push('Longitude harus antara -180 hingga 180.');
      }
      // Ensure decimal format rules: zero must be "0", non-zero should include decimal part
      const latStr = this.formatLatForApi(la);
      const lngStr = this.formatLngForApi(lo);
      const latOk = latStr === '0' || /\./.test(latStr);
      const lngOk = lngStr === '0' || /\./.test(lngStr);
      if (!latOk) errors.push('Latitude harus 0 atau memiliki format desimal (contoh -6.200000).');
      if (!lngOk) errors.push('Longitude harus 0 atau memiliki format desimal (contoh 106.800000).');
      return { ok: errors.length === 0, errors, normalized: { vessel, name: nm, lat: la, lng: lo, latStr, lngStr } };
    },
    async fetchWaypointsForShip(sn, shipId) {
      // Deprecated: kept for backward compatibility; prefer fetchWaypointsForShipById
      return this.fetchWaypointsForShipById(sn, shipId);
    },
    async fetchWaypointsForShipById(vesselId, shipId) {
      try {
        if (!vesselId || !shipId) return;
        const url = `https://bcknd.fly.dev/api/v1/waypoint/vessel/${encodeURIComponent(vesselId)}`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'include' });
        if (!resp.ok) {
          console.warn('Fetch waypoints failed:', resp.status);
          return;
        }
        const data = await resp.json();
        // Expecting an array of items with name and coordinate { latitude, longitude }
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        const waypoints = list.map((it) => {
          const name = this.truncateName24(it.name || it.nama || '-');
          const latStr = it.coordinate?.latitude ?? it.lat ?? it.latitude;
          const lngStr = it.coordinate?.longitude ?? it.lng ?? it.longitude;
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          const id = it.id || it._id || it.waypointId || null;
          return { id, name, lat, lng };
        }).filter(w => isFinite(w.lat) && isFinite(w.lng));
        // Rebuild local markers/list for this ship
        // Clear previous markers for ship
        if (!this.waypointsByShip[shipId]) this.waypointsByShip[shipId] = { markers: [], list: [] };
        // Remove old markers from map
        this.waypointsByShip[shipId].markers.forEach(m => { if (this.map.hasLayer(m)) this.map.removeLayer(m); });
        this.waypointsByShip[shipId].markers = [];
        this.waypointsByShip[shipId].list = [];

        waypoints.forEach((wp) => {
          const marker = L.marker([wp.lat, wp.lng], { 
            icon: this.waypointIcon(),
            zIndexOffset: 200,
          });
          marker.bindPopup(`<b>${wp.name}</b><br>Lat: ${wp.lat.toFixed(6)}<br>Lng: ${wp.lng.toFixed(6)}`, {
            closeButton: true,
            autoPanPadding: [10, 10],
          });
          // Only add to map if this ship is currently selected and not hidden by tracking history
          const shouldShow = this.selectedShip && this.selectedShip.id === shipId && (!this.trackingActiveShipId || this.trackingActiveShipId !== shipId);
          if (shouldShow) marker.addTo(this.map);
          this.waypointsByShip[shipId].markers.push(marker);
          this.waypointsByShip[shipId].list.push({ id: wp.id, name: wp.name, lat: wp.lat, lng: wp.lng });
        });

        // Refresh route lines/panel if this ship is selected and waypoints are visible
        if (this.selectedShip && this.selectedShip.id === shipId) {
          if (!this.isTrackingActiveForShip(shipId)) {
            this.updateRouteSummary();
            this.updateRouteLines();
            this.showWaypointETA = this.waypointsByShip[shipId].list.length > 0;
          } else {
            this.clearRouteLines();
            this.showWaypointETA = false;
          }
        }
      } catch (e) {
        console.warn('Error fetching waypoints:', e);
      }
    },
    async handleDeleteWaypointsDb(sn) {
      // Deprecated: kept for backward compatibility; prefer handleDeleteWaypointsDbByVesselId
      return this.handleDeleteWaypointsDbByVesselId(sn);
    },
    async handleDeleteWaypointsDbByVesselId(vesselId) {
      try {
        if (!vesselId) return;
        const url = `https://bcknd.fly.dev/api/v1/waypoint/vessel/${encodeURIComponent(vesselId)}`;
        const resp = await fetch(url, { method: 'DELETE', headers: { 'Accept': 'application/json' }, credentials: 'include' });
        if (!resp.ok) {
          let serverMsg = '';
          try {
            const j = await resp.json();
            serverMsg = j?.message || j?.error || JSON.stringify(j);
          } catch (_) {
            serverMsg = await resp.text().catch(() => resp.statusText);
          }
          throw new Error(serverMsg || `Gagal menghapus waypoint (HTTP ${resp.status})`);
        }
        // Clear local state for the selected ship if matches
        const ship = this.ships.find(s => s.id === vesselId);
        const shipId = ship ? ship.id : (this.selectedShip ? this.selectedShip.id : null);
        if (shipId && this.waypointsByShip[shipId]) {
          // Remove markers from map
          this.waypointsByShip[shipId].markers.forEach(m => { if (this.map.hasLayer(m)) this.map.removeLayer(m); });
          this.waypointsByShip[shipId].markers = [];
          this.waypointsByShip[shipId].list = [];
        }
        // Remove route lines
        if (this.routeLines && this.routeLines.length) {
          this.routeLines.forEach(line => this.map.removeLayer(line));
          this.routeLines = [];
        }
        // Hide ETA panel, then refetch from server to confirm empty
        this.showWaypointETA = false;
        if (ship) await this.fetchWaypointsForShipById(ship.id, ship.id);
        alert('Semua waypoint kapal berhasil dihapus dari database.');
      } catch (e) {
        alert('Gagal menghapus waypoint dari database.\n\nDetail: ' + (e?.message || 'Unknown error'));
      }
    },
    onGlobalButtonClick(e) {
      try {
        const target = e.target;
        if (!target) return;
        const btn = target.closest && target.closest('button');
        if (!btn) return; // not a button click
        // Ignore the Waypoint ETA toggle button itself
        if (btn.classList && btn.classList.contains('waypoint-eta-btn')) return;
        // Close the ETA panel on any other button click
        this.showWaypointETA = false;
      } catch (_) {
        // no-op
      }
    },
    normalizeShipsResponse(data) {
      let shipsData = [];
      if (Array.isArray(data)) {
        shipsData = data;
      } else if (data && Array.isArray(data.data)) {
        shipsData = data.data;
      } else if (data && Array.isArray(data.ships)) {
        shipsData = data.ships;
      } else if (data && Array.isArray(data.vessels)) {
        shipsData = data.vessels;
      } else {
        console.warn('⚠️ Unexpected API response format:', data);
        throw new Error('Format response API tidak sesuai');
      }

      const parseCoordinate = (value) => {
        if (value === null || value === undefined) return NaN;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return NaN;
          const num = Number(trimmed);
          return Number.isFinite(num) ? num : NaN;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : NaN;
      };

      const mapped = shipsData.map((ship, index) => {
        const snCandidates = [
          ship.device_sn,
          ship.deviceSn,
          ship.sn,
          ship.serial_number,
          ship.serialNumber,
          ship.id,
        ];
        const rawSn = snCandidates.find((candidate) => {
          if (candidate === null || candidate === undefined) return false;
          return String(candidate).trim().length > 0;
        });
        const normalizedSn = this.normalizeVesselSn(rawSn);
        const effectiveSn = normalizedSn || (rawSn !== null && rawSn !== undefined ? String(rawSn).trim() : `SN${index + 1}`);

        const positionArray = Array.isArray(ship.position)
          ? ship.position
          : (Array.isArray(ship.coordinates) ? ship.coordinates : null);
        const latSource = positionArray ? positionArray[0] : (ship.lat ?? ship.latitude ?? ship.latitud);
        const lngSource = positionArray ? positionArray[1] : (ship.lng ?? ship.longitude ?? ship.longitud ?? ship.lon);
        const lat = parseCoordinate(latSource);
        const lng = parseCoordinate(lngSource);

        const speedCandidate = parseCoordinate(ship.speed ?? ship.sog ?? ship.speed_knots);
        const headingCandidate = parseCoordinate(ship.heading ?? ship.cog ?? ship.course);

        const lastTransRaw = ship.last_transmitted_at
          || ship.lastTransmittedAt
          || ship.last_transmit_at
          || ship.lastTransmissionAt
          || ship.last_seen_at
          || ship.last_seen
          || null;
        const transmitDateRaw = ship.transmit_date
          || ship.transmitDate
          || (typeof lastTransRaw === 'string' ? lastTransRaw.split(' ')[0] : null);
        const transmitDateDisplay = this.formatDateOnly(transmitDateRaw);
        const lastTransDisplay = lastTransRaw ? this.formatTimestampToYMDHMS(lastTransRaw) : null;

        const rawName = ship.name || ship.nama_kapal || ship.vessel_name || ship.ship_name;
        const effectiveName = rawName && String(rawName).trim().length > 0
          ? String(rawName).trim()
          : `Kapal ${index + 1}`;

        return {
          id: ship.id || ship.mmsi || ship.imo || `ship_${index}`,
          sn: effectiveSn,
          deviceSn: effectiveSn,
          name: effectiveName,
          lat,
          lng,
          colorCode: ship.colorCode || '#3498db', // default; will keep existing on marker if present
          shipSpeed: Number.isNaN(speedCandidate) ? 0 : speedCandidate,
          heading: Number.isNaN(headingCandidate) ? 0 : headingCandidate,
          status: ship.status || ship.vessel_status || ship.state || '',
          powerSource: ship.power_source || ship.powerSource || '',
          dataSource: ship.data_source || ship.dataSource || ship.provider || '',
          lastTransmittedAt: lastTransRaw,
          lastTransmittedAtDisplay: lastTransDisplay,
          transmitDate: transmitDateRaw,
          transmitDateDisplay,
        };
      });

      // Filter invalid
      return mapped.filter((ship) => {
        if (!Number.isFinite(ship.lat) || !Number.isFinite(ship.lng)) return false;
        if (ship.lat < -90 || ship.lat > 90) return false;
        if (ship.lng < -180 || ship.lng > 180) return false;
        const isOrigin = Math.abs(ship.lat) < 1e-8 && Math.abs(ship.lng) < 1e-8;
        return !isOrigin;
      });
    },
    getDateInJakarta(offsetDays = 0) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      let year = 0;
      let month = 0;
      let day = 0;
      parts.forEach(({ type, value }) => {
        if (type === 'year') year = Number(value);
        if (type === 'month') month = Number(value);
        if (type === 'day') day = Number(value);
      });
      if (!year || !month || !day) {
        return new Date().toISOString().slice(0, 10);
      }
      const base = new Date(Date.UTC(year, month - 1, day));
      if (offsetDays) {
        base.setUTCDate(base.getUTCDate() + offsetDays);
      }
      const pad = (value) => value.toString().padStart(2, '0');
      return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
    },
    getActiveDateString() {
      return this.getDateInJakarta(0);
    },
    getCurrentAccountId() {
      const source = this.user || {};
      const candidates = [
        source.id,
        source.user_id,
        source.userId,
        source.account_id,
        source.accountId,
        source.user && source.user.id,
        source.data && source.data.user && source.data.user.id,
      ];
      const found = candidates.find((value) => {
        if (typeof value === 'string' && value.trim().length > 0) return true;
        if (typeof value === 'number' && Number.isFinite(value)) return true;
        return false;
      });
      if (found === undefined || found === null) {
        return null;
      }
      return found.toString().trim();
    },
    getActiveDateCandidates(windowDays = 5) {
      const seen = new Set();
      const include = (value) => {
        if (value && typeof value === 'string' && value.trim().length > 0) {
          seen.add(value.trim());
        }
      };
      include(this.lastSuccessfulActiveDate);
      include(this.getActiveDateString());
      for (let dayOffset = 1; dayOffset <= windowDays; dayOffset += 1) {
        include(this.getDateInJakarta(-dayOffset));
      }
      return Array.from(seen);
    },
    buildVesselListURL(arg = {}) {
      let searchTerm = '';
      let activeDate = null;
      if (typeof arg === 'string') {
        searchTerm = arg;
      } else if (arg && typeof arg === 'object') {
        ({ searchTerm = '', activeDate = null } = arg);
      }
      const url = new URL('https://bcknd.fly.dev/api/v1/vessel');
      const effectiveDate = activeDate || this.lastSuccessfulActiveDate || this.getActiveDateString();
      //url.searchParams.set('active_date', effectiveDate);
      if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
        url.searchParams.set('name', searchTerm.trim());
      }
      // Removed account_id/accountId injection because backend vessel endpoint
      // only permits ONE query key (name OR active_date OR provider). Adding
      // account parameters caused 422 VALIDATION_ERROR: Too many query parameters.
      // Access filtering is now handled server-side via session user context.
      return url.toString();
    },
    async fetchShipsForDate(activeDate) {
      const requestUrl = this.buildVesselListURL({ activeDate });
      try {
        const response = await fetch(requestUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const error = new Error(`HTTP ${response.status} ${response.statusText}`);
          error.responseBody = body;
          error.status = response.status;
          return { ok: false, status: response.status, error, ships: [], raw: null, url: requestUrl, activeDate };
        }
        const json = await response.json().catch(() => ({}));
        const normalized = this.normalizeShipsResponse(json);
        return { ok: true, status: response.status, ships: normalized, raw: json, url: requestUrl, activeDate };
      } catch (error) {
        return { ok: false, status: null, error, ships: [], raw: null, url: requestUrl, activeDate };
      }
    },
    applyShipsDataset(ships) {
      const dataset = Array.isArray(ships) ? ships : [];
      const normalized = dataset.map((s, idx) => {
        const fallbackSn = s && s.sn !== null && s.sn !== undefined ? String(s.sn).trim() : '';
        const normalizedSn = this.normalizeVesselSn(s?.sn || s?.deviceSn);
        const effectiveSn = normalizedSn || fallbackSn || `SN${idx + 1}`;
        const lastTransRaw = s?.lastTransmittedAt || s?.last_transmitted_at || null;
        const transmitDateRaw = s?.transmitDate || s?.transmit_date || null;
        return {
          ...s,
          sn: effectiveSn,
          deviceSn: s?.deviceSn || effectiveSn,
          lastTransmittedAt: lastTransRaw,
          lastTransmittedAtDisplay: s?.lastTransmittedAtDisplay || (lastTransRaw ? this.formatTimestampToYMDHMS(lastTransRaw) : null),
          transmitDate: transmitDateRaw,
          transmitDateDisplay: s?.transmitDateDisplay || this.formatDateOnly(transmitDateRaw),
          status: s?.status || '',
          dataSource: s?.dataSource || '',
          powerSource: s?.powerSource || '',
        };
      });
      if (this.map && Array.isArray(this.markers)) {
        this.markers.forEach((marker) => {
          if (marker && this.map.hasLayer(marker)) {
            this.map.removeLayer(marker);
          }
        });
      }
      this.markers = [];
      const enhancedShips = normalized.map((ship, index) => ({
        ...ship,
        colorCode: ship.colorCode || this.getShipColor(index),
      }));
      // Optional per-user vessel access filtering (non-admin only)
      let finalShips = enhancedShips;
      if (!this.isAdmin) {
        const allowed = this.extractAccessibleSerials(this.user);
        if (Array.isArray(allowed) && allowed.length > 0) {
          const set = new Set(allowed.map(v => v.toString()));
          finalShips = finalShips.filter(s => set.has((s.sn || '').toString()));
        }
      }
      finalShips.forEach((ship) => {
        if (Number.isNaN(ship.lat) || Number.isNaN(ship.lng)) return;
        const marker = L.marker([ship.lat, ship.lng], {
          icon: this.shipIcon(ship),
          zIndexOffset: 100,
        });
        marker.shipData = ship;
        marker.on('popupclose', () => {
          this.clearSelectedShip();
        });
        marker.on('click', () => {
          this.focusShip(ship);
        });
        if (this.map) {
          this.map.addLayer(marker);
          marker.setOpacity(1);
        }
        this.markers.push(marker);
      });
      const previouslySelectedId = this.selectedShip ? this.selectedShip.id : null;
      this.ships = finalShips;
      if (previouslySelectedId) {
        const replacement = this.ships.find((ship) => ship.id === previouslySelectedId);
        if (replacement && this.selectedShip) {
          Object.assign(this.selectedShip, replacement);
        } else {
          this.clearSelectedShip();
        }
      }
      this.renderShips();
      this.ships.forEach((ship) => {
        if (ship.id) {
          this.fetchWaypointsForShipById(ship.id, ship.id);
        }
      });
    },
    async refreshShipsPositions() {
      try {
        this.isRefreshingShips = true;
        const resp = await fetch(this.buildVesselListURL({ activeDate: this.lastSuccessfulActiveDate || undefined }), {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (!resp.ok) {
          console.warn('Ship refresh HTTP error:', resp.status);
          return; // keep old positions if refresh fails
        }
        const data = await resp.json();
        const newShips = this.normalizeShipsResponse(data);
        if (!newShips.length) {
          console.warn('Ship refresh returned no data; keeping previous positions intact.');
          return;
        }

        // Index new by id
        const newById = new Map(newShips.map(s => [s.id, s]));

        // Update or remove existing markers
        const updatedMarkers = [];
        this.markers.forEach(marker => {
          const oldShip = marker.shipData;
          if (!oldShip) return;
          const ns = newById.get(oldShip.id);
          if (!ns) {
            // Ship missing now: remove marker
            if (this.map.hasLayer(marker)) this.map.removeLayer(marker);
            return; // skip keeping this marker
          }
          // Update marker position if changed
          const oldPos = marker.getLatLng();
          if (oldPos.lat !== ns.lat || oldPos.lng !== ns.lng) {
            marker.setLatLng([ns.lat, ns.lng]);
          }
          const mergedShip = { ...oldShip, ...ns, colorCode: oldShip.colorCode || ns.colorCode };
          marker.shipData = mergedShip;
          marker.setIcon(this.shipIcon(mergedShip));
          updatedMarkers.push(marker);
        });

        // Determine ships without markers yet
        const existingIds = new Set(updatedMarkers.map(m => m.shipData && m.shipData.id));
        const toAdd = newShips.filter(s => !existingIds.has(s.id));
        toAdd.forEach(ship => {
          const marker = L.marker([ship.lat, ship.lng], {
            icon: this.shipIcon(ship),
            zIndexOffset: 100,
          });
          marker.shipData = ship;
          marker.on('popupclose', () => {
            this.clearSelectedShip();
          });
          marker.on('click', () => {
            this.focusShip(ship);
          });
          this.map.addLayer(marker);
          marker.setOpacity(1);
          updatedMarkers.push(marker);
        });

        // Replace markers array with updated list
        this.markers = updatedMarkers;

        // Update ships array reference used by sidebar
        this.ships = newShips.map((s, idx) => {
          // Try to keep colorCode consistent based on existing marker for same id
          const m = this.markers.find(mm => mm.shipData && mm.shipData.id === s.id);
          return { ...s, colorCode: m && m.shipData ? m.shipData.colorCode : this.getShipColor(idx) };
        });

        // Maintain selection: rebind selectedShip to updated object
        if (this.selectedShip) {
          const updated = this.ships.find(s => s.id === this.selectedShip.id);
          if (updated) {
            // Update in place to avoid triggering watcher and auto-centering
            Object.assign(this.selectedShip, updated);
          }
        }

        // Re-render ship markers visibility only (no tracking changes)
        this.renderShips();
        if (this.selectedShip) {
          if (!this.isTrackingActiveForShip(this.selectedShip.id)) {
            this.updateRouteSummary();
            this.updateRouteLines();
          } else {
            this.clearRouteLines();
          }
        }
      } catch (e) {
        console.warn('Ship refresh failed:', e);
      } finally {
        this.isRefreshingShips = false;
      }
    },
    renderShips() {
      // ULTRA FAST: Use opacity changes instead of add/remove layer for instant visibility
      this.markers.forEach((marker) => {
        const ship = marker.shipData;
        if (!ship) return;

        const shouldShow = !this.selectedShip || ship.id === this.selectedShip.id;

        // Use opacity for instant visibility changes
        marker.setOpacity(shouldShow ? 1 : 0);
      });

  // Sembunyikan semua waypoint markers terlebih dahulu (jangan sentuh tracking agar tetap tampil)
  this.hideAllWaypoints();

      // Pastikan waypoint kapal yang sedang dipilih tetap ditampilkan setelah re-render
      if (this.selectedShip && !this.isTrackingActiveForShip(this.selectedShip.id)) {
        this.showWaypointsForShip(this.selectedShip.id);
        // Buka popup untuk kapal yang dipilih setelah re-render
        const selectedMarker = this.markers.find(
          (m) => m.shipData && m.shipData.id === this.selectedShip.id
        );
        if (selectedMarker && !selectedMarker.isPopupOpen()) {
          selectedMarker.openPopup();
        }
      }
    },
    focusShip(ship) {
      this.handleTrackingBeforeShipSwitch(ship.id);
      // Sembunyikan semua tracking history (icon titik & garis) dari semua kapal
      this.hideAllTracks();
      this.clearRouteLines();

      // FORCE INSTANT REACTIVITY UPDATE
      this.selectedShip = ship;
      this.selectedShipTrigger++; // Trigger reactivity update
      this.$forceUpdate();

      // Ensure DOM update with nextTick, then render immediately
      this.$nextTick(() => {
        const store = this.trackingByShip[ship.id];
        if (store && Array.isArray(store.markers) && store.markers.length > 0) {
          this.trackingActiveShipId = ship.id;
          this.trackingSliderMax = store.markers.length > 0 ? store.markers.length - 1 : 0;
          this.trackingSliderIndex = 0;
          this.trackingSliderEnabled = false;
          this.trackingCurrentTime = null;
          this.trackingCurrentCount = 0;
          this.trackingFullLinePinned = false;
          if (this.trackingInfoByShip[ship.id]) {
            this.trackingInfo = { ...this.trackingInfoByShip[ship.id] };
          } else {
            this.trackingInfo = null;
          }
          this.trackingExportRows = this.trackingExportRowsByShip[ship.id] || [];
          this.updateTrackingLayers(ship.id);
        } else {
          if (this.trackingActiveShipId === ship.id) {
            this.trackingActiveShipId = null;
          }
          this.trackingSliderEnabled = false;
          this.trackingSliderIndex = 0;
          this.trackingSliderMax = 0;
          this.trackingCurrentTime = null;
          this.trackingCurrentCount = 0;
          if (!this.trackingInfoByShip[ship.id]) {
            this.trackingInfo = null;
          }
          this.trackingExportRows = [];
        }
        this.renderShips();
        // Fetch persisted waypoints for this ship
        if (ship && ship.id) this.fetchWaypointsForShipById(ship.id, ship.id);
      });
    },
    clearSelectedShip() {
      this.deactivateTrackingHistory();
      this.hideAllWaypoints();
      this.clearRouteLines();
      this.showWaypointETA = false;

      // FORCE INSTANT REACTIVITY UPDATE
      this.selectedShip = null;
      this.selectedShipTrigger++; // Trigger reactivity update
      this.$forceUpdate();

      // Ensure DOM update with nextTick, then render immediately
      this.$nextTick(() => {
        this.renderShips();
        this.animateZoomToAllShips();
      });
    },
    handleKmlKmzError(msg) {
      if (this.globalKmlKmzErrorTimer) {
        clearTimeout(this.globalKmlKmzErrorTimer);
        this.globalKmlKmzErrorTimer = null;
      }
      this.globalKmlKmzError = msg;
      this.globalKmlKmzErrorTimer = setTimeout(() => {
        this.globalKmlKmzError = null;
        this.globalKmlKmzErrorTimer = null;
      }, 3000);
    },
    handleKmlKmzSuccess(msg) {
      if (this.globalKmlKmzSuccessTimer) {
        clearTimeout(this.globalKmlKmzSuccessTimer);
        this.globalKmlKmzSuccessTimer = null;
      }
      this.globalKmlKmzSuccess = msg || 'Layer KML/KMZ berhasil dimuat';
      this.globalKmlKmzSuccessTimer = setTimeout(() => {
        this.globalKmlKmzSuccess = null;
        this.globalKmlKmzSuccessTimer = null;
      }, 3000);
    },
    animateZoomToAllShips() {
      if (!this.map || !Array.isArray(this.markers) || this.markers.length === 0) return;
      const latLngs = this.markers
        .map((marker) => (marker && marker.shipData ? marker.getLatLng() : null))
        .filter(Boolean);
      if (latLngs.length === 0) return;

      if (latLngs.length === 1) {
        const target = latLngs[0];
        const currentZoom = this.map.getZoom();
        const targetZoom = Math.min(currentZoom, 12);
        this.map.flyTo(target, targetZoom, { duration: 1, easeLinearity: 0.25 });
        return;
      }

      const bounds = L.latLngBounds(latLngs);
      if (!bounds.isValid()) return;

      const padding = [80, 80];
      const currentZoom = this.map.getZoom();
      const mapBounds = this.map.getBounds();
      const targetZoom = this.map.getBoundsZoom(bounds, false, padding);

      const alreadyVisible = mapBounds && mapBounds.isValid() && mapBounds.pad(-0.15).contains(bounds);
      if (alreadyVisible && targetZoom >= currentZoom) {
        return;
      }

      if (targetZoom < currentZoom - 0.05) {
        this.map.flyToBounds(bounds, {
          padding,
          duration: 1.2,
          easeLinearity: 0.25,
          animate: true,
        });
      } else if (!alreadyVisible) {
        this.map.flyTo(bounds.getCenter(), currentZoom, { duration: 1, easeLinearity: 0.25 });
      }
    },
    scrollToSelectedShip() {
      if (!this.selectedShip) return;
      
      const selectedElement = document.querySelector('.ship-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    },
    clearWaypoints() {
      if (!this.selectedShip || !this.waypointsByShip[this.selectedShip.id]) return;
      
      // Hanya sembunyikan markers, jangan hapus data
      this.waypointsByShip[this.selectedShip.id].markers.forEach((m) => this.map.removeLayer(m));
      this.waypointSummary = [];
    },
    showWaypointsForShip(shipId) {
      if (this.isTrackingActiveForShip(shipId)) return;
      if (!this.waypointsByShip[shipId]) return;
      
      // Tampilkan semua markers untuk kapal tertentu
      this.waypointsByShip[shipId].markers.forEach((marker) => {
        if (!this.map.hasLayer(marker)) {
          this.map.addLayer(marker);
        }
      });
    },
    hideWaypointsForShip(shipId) {
      if (!this.waypointsByShip[shipId]) return;
      
      // Sembunyikan semua markers untuk kapal tertentu
      this.waypointsByShip[shipId].markers.forEach((marker) => {
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      });
      if (this.selectedShip && this.selectedShip.id === shipId) {
        this.clearRouteLines();
      }
    },
    hideAllWaypoints() {
      // Sembunyikan semua waypoint markers dari semua kapal
      Object.keys(this.waypointsByShip).forEach(shipId => {
        this.hideWaypointsForShip(shipId);
      });
      this.waypointSummary = [];
      this.clearRouteLines();
    },
    // Tracking helpers
    hideTracksForShip(shipId) {
      if (!this.trackingByShip[shipId]) return;
      const obj = this.trackingByShip[shipId];
      (obj.markers || []).forEach(entry => {
        const m = entry && entry.marker ? entry.marker : entry;
        if (m && this.map.hasLayer(m)) this.map.removeLayer(m);
      });
      (obj.lines || []).forEach(l => { if (this.map.hasLayer(l)) this.map.removeLayer(l); });
      if (obj.fullLine && this.map.hasLayer(obj.fullLine)) {
        this.map.removeLayer(obj.fullLine);
      }
    },
    hideAllTracks() {
      Object.keys(this.trackingByShip).forEach(id => this.hideTracksForShip(id));
    },
    isTrackingActiveForShip(shipId) {
      return Boolean(shipId && this.trackingActiveShipId && this.trackingActiveShipId === shipId);
    },
    clearRouteLines() {
      if (!this.routeLines || this.routeLines.length === 0) return;
      this.routeLines.forEach(line => {
        if (this.map && this.map.hasLayer(line)) {
          this.map.removeLayer(line);
        }
      });
      this.routeLines = [];
    },
    deactivateTrackingHistory() {
      const activeId = this.trackingActiveShipId;
      this.stopAutoPlayInternal();
      this.hideAllTracks();
      if (activeId && this.trackingByShip[activeId]) {
        delete this.trackingByShip[activeId];
      }
      if (activeId && this.trackingInfoByShip[activeId]) {
        delete this.trackingInfoByShip[activeId];
      }
      if (activeId && this.trackingDaysByShip[activeId]) {
        delete this.trackingDaysByShip[activeId];
      }
      this.trackingAutoPlaying = false;
      this.trackingFullLinePinned = false;
      this.trackingSliderEnabled = false;
      this.trackingSliderIndex = 0;
      this.trackingSliderMax = 0;
      this.trackingCurrentTime = null;
      this.trackingCurrentCount = 0;
      this.trackingActiveShipId = null;
      this.trackingInfo = null;
      this.showTrackingHistory = false;
    },
    handleTrackingBeforeShipSwitch(nextShipId) {
      const activeId = this.trackingActiveShipId;
      if (!activeId) return;

      const currentSelectedId = this.selectedShip ? this.selectedShip.id : null;
      if (currentSelectedId === activeId) {
        this.cancelTrackingSlider();
      } else {
        this.stopAutoPlayInternal();
        this.hideTracksForShip(activeId);
      }

      const store = this.trackingByShip[activeId];
      if (store) {
        if (store.fullLine && this.map && this.map.hasLayer(store.fullLine)) {
          this.map.removeLayer(store.fullLine);
        }
        (store.lines || []).forEach(line => {
          if (this.map && this.map.hasLayer(line)) {
            this.map.removeLayer(line);
          }
        });
        store.lines = [];
      }

      this.trackingAutoPlaying = false;
      this.trackingSliderEnabled = false;
      this.trackingSliderIndex = 0;
      this.trackingSliderMax = 0;
      this.trackingCurrentTime = null;
      this.trackingCurrentCount = 0;
      this.trackingFullLinePinned = false;
      this.trackingActiveShipId = null;
      this.trackingInfo = null;
      this.showTrackingHistory = false;
      this.trackingExportRows = [];
    },
    updateTrackingLayers(shipId) {
      const store = this.trackingByShip[shipId];
      if (!store) return;
      // Remove existing
      (store.markers || []).forEach(obj => { if (this.map.hasLayer(obj.marker)) this.map.removeLayer(obj.marker); });
      (store.lines || []).forEach(line => { if (this.map.hasLayer(line)) this.map.removeLayer(line); });
      store.lines = [];

      // When slider is disabled, render full track
      if (!this.trackingSliderEnabled) {
        const latlngs = (store.markers || []).map(obj => [obj.lat, obj.lng]);
        (store.markers || []).forEach(obj => { if (!this.map.hasLayer(obj.marker)) obj.marker.addTo(this.map); });
        this.trackingCurrentCount = store.markers.length;
        const lastObj = store.markers[store.markers.length - 1] || null;
        this.trackingCurrentTime = lastObj && lastObj.ts ? this.formatTimestampToYMDHMS(lastObj.ts) : null;
        // Ensure persistent full polyline is displayed
        if (latlngs.length > 1) {
          if (!store.fullLine) {
            store.fullLine = L.polyline(latlngs, { color: '#1976d2', weight: 3 });
          } else {
            store.fullLine.setLatLngs(latlngs);
          }
          if (!this.map.hasLayer(store.fullLine)) store.fullLine.addTo(this.map);
        } else if (store.fullLine && this.map.hasLayer(store.fullLine)) {
          this.map.removeLayer(store.fullLine);
        }
        return;
      }

      // Slider enabled: two modes
      // - Autoplay: keep full polyline static and move only the current icon
      // - Manual: show only current point and the segment from previous to current
      const upto = Math.min(this.trackingSliderIndex, store.markers.length - 1);
      const currentObj = store.markers[upto] || null;
      if (currentObj && !this.map.hasLayer(currentObj.marker)) { currentObj.marker.addTo(this.map); }
      // Update meta: count reflects current point index (1-based)
      this.trackingCurrentCount = upto >= 0 ? upto + 1 : 0;
  this.trackingCurrentTime = currentObj && currentObj.ts ? this.formatTimestampToYMDHMS(currentObj.ts) : null;
      if (this.trackingAutoPlaying) {
        // Ensure full polyline exists and is visible
        const latlngs = (store.markers || []).map(obj => [obj.lat, obj.lng]);
        if (latlngs.length > 1) {
          if (!store.fullLine) {
            store.fullLine = L.polyline(latlngs, { color: '#1976d2', weight: 3 });
          } else {
            store.fullLine.setLatLngs(latlngs);
          }
          if (!this.map.hasLayer(store.fullLine)) store.fullLine.addTo(this.map);
        }
        // No segment line; only icon moves
        if (store.fullLine && this.map.hasLayer(store.fullLine)) {
          // already visible
        }
      } else {
        // Manual slider mode: show only prev->current segment
        // If pinned (after autoplay), keep fullLine visible; else hide it
        if (this.trackingFullLinePinned) {
          const latlngs = (store.markers || []).map(obj => [obj.lat, obj.lng]);
          if (latlngs.length > 1) {
            if (!store.fullLine) {
              store.fullLine = L.polyline(latlngs, { color: '#1976d2', weight: 3 });
            } else {
              store.fullLine.setLatLngs(latlngs);
            }
            if (!this.map.hasLayer(store.fullLine)) store.fullLine.addTo(this.map);
          }
        } else {
          if (store.fullLine && this.map.hasLayer(store.fullLine)) {
            this.map.removeLayer(store.fullLine);
          }
        }
        if (upto > 0) {
          const prev = store.markers[upto - 1];
          const poly = L.polyline([[prev.lat, prev.lng], [currentObj.lat, currentObj.lng]], { color: '#1976d2', weight: 3 }).addTo(this.map);
          store.lines.push(poly);
        }
      }
    },
    enableTrackingSlider() {
      if (this.trackingSliderEnabled) return;
      this.trackingSliderEnabled = true;
      this.trackingSliderIndex = 0;
      this.trackingFullLinePinned = false;
      this.trackingPlaybackComplete = false;
      // Hide waypoints and ETA when entering tracking slider mode
      if (this.selectedShip && this.trackingActiveShipId === this.selectedShip.id) {
        this.hideWaypointsForShip(this.selectedShip.id);
        if (this.routeLines && this.routeLines.length) {
          this.routeLines.forEach(line => this.map.removeLayer(line));
          this.routeLines = [];
        }
        this.showWaypointETA = false;
      }
      if (this.trackingActiveShipId) this.updateTrackingLayers(this.trackingActiveShipId);
    },
    disableTrackingSlider() {
      if (!this.trackingSliderEnabled) return;
      this.trackingSliderEnabled = false;
      // When disabling, show full track again
      if (this.trackingActiveShipId) {
        this.updateTrackingLayers(this.trackingActiveShipId);
        if (this.selectedShip && !this.isTrackingActiveForShip(this.selectedShip.id)) {
          this.showWaypointsForShip(this.selectedShip.id);
          this.updateRouteSummary();
          this.updateRouteLines();
          this.showWaypointETA = this.waypointsByShip[this.selectedShip.id] && this.waypointsByShip[this.selectedShip.id].list.length > 0;
        }
      }
      this.trackingPlaybackComplete = false;
    },
    onTrackingSliderInput() {
      // User manually moved the slider: unpin full line so manual mode behavior applies
      this.trackingFullLinePinned = false;
      this.trackingPlaybackComplete = false;
      if (this.trackingActiveShipId) this.updateTrackingLayers(this.trackingActiveShipId);
    },
    cancelTrackingSlider() {
      // Stop autoplay and disable slider, then restore full track
      this.stopAutoPlayInternal();
      this.trackingSliderEnabled = false;
      this.trackingSliderIndex = 0;
      this.trackingFullLinePinned = false;
      this.trackingPlaybackComplete = false;
      if (this.trackingActiveShipId) {
        this.updateTrackingLayers(this.trackingActiveShipId);
        // Always hide waypoints and ETA when cancel is clicked (per requirement)
        if (this.selectedShip && this.selectedShip.id === this.trackingActiveShipId) {
          this.hideWaypointsForShip(this.selectedShip.id);
          if (this.routeLines && this.routeLines.length) {
            this.routeLines.forEach(line => this.map.removeLayer(line));
            this.routeLines = [];
          }
          this.showWaypointETA = false;
        }
      }
    },
    enableSliderAndPlay() {
      this.enableTrackingSlider();
      // Immediately start autoplay
      this.startAutoPlay();
    },
    startAutoPlay() {
      if (!this.trackingSliderEnabled || this.trackingAutoPlaying) return;
      this.trackingPlaybackComplete = false;
      this.trackingFullLinePinned = false;
      // If currently at the end, reset to start before playing (no update yet)
      if (this.trackingSliderIndex >= this.trackingSliderMax) {
        this.trackingSliderIndex = 0;
      }
      this.trackingAutoPlaying = true;
      // Clear any existing timer
      if (this.trackingAutoTimer) {
        clearInterval(this.trackingAutoTimer);
        this.trackingAutoTimer = null;
      }
      // Immediately render first frame in autoplay mode so full polyline is shown from the start
      if (this.trackingActiveShipId) this.updateTrackingLayers(this.trackingActiveShipId);
      // Advance every 1s
      this.trackingAutoTimer = setInterval(() => {
        if (!this.trackingActiveShipId) return;
        if (this.trackingSliderIndex < this.trackingSliderMax) {
          this.trackingSliderIndex += 1;
          this.updateTrackingLayers(this.trackingActiveShipId);
        } else {
          // Reached end: stop autoplay, keep slider at last point, show rewatch
          this.stopAutoPlayInternal();
          // Keep full polyline visible after autoplay ends
          this.trackingFullLinePinned = true;
          this.trackingSliderIndex = this.trackingSliderMax;
          this.updateTrackingLayers(this.trackingActiveShipId);
          this.trackingPlaybackComplete = true;
        }
      }, 1000);
    },
    pauseAutoPlay() {
      // Pause autoplay but keep slider enabled
      this.stopAutoPlayInternal();
    },
    rewatchAutoPlay() {
      if (!this.trackingSliderEnabled) return;
      this.trackingFullLinePinned = false;
      this.trackingPlaybackComplete = false;
      this.trackingSliderIndex = 0;
      if (this.trackingActiveShipId) this.updateTrackingLayers(this.trackingActiveShipId);
      this.startAutoPlay();
    },
    stopAutoPlayInternal() {
      if (this.trackingAutoTimer) {
        clearInterval(this.trackingAutoTimer);
        this.trackingAutoTimer = null;
      }
      this.trackingAutoPlaying = false;
    },
    formatTimestampToYMDHMS(ts) {
      try {
        // ts may be ISO string, numeric epoch (seconds or ms), or another string
        let d;
        const n = Number(ts);
        if (!Number.isNaN(n) && Number.isFinite(n)) {
          // Heuristic: if n < 1e12 treat as seconds, else milliseconds
          d = new Date(n < 1e12 ? n * 1000 : n);
        } else {
          d = new Date(ts);
        }
        if (isNaN(d.getTime())) return String(ts);
        const pad = (x) => String(x).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        const ss = pad(d.getSeconds());
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
      } catch (_) {
        return String(ts);
      }
    },
    formatDateOnly(value) {
      if (value === null || value === undefined) return null;
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        const pad = (x) => String(x).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return trimmed;
        const pad = (x) => String(x).padStart(2, '0');
        return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
      }
      try {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        const pad = (x) => String(x).padStart(2, '0');
        return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
      } catch (_) {
        return null;
      }
    },
    formatShipDate(value) {
      const formatted = this.formatDateOnly(value);
      return formatted && formatted.length ? formatted : '-';
    },
    formatShipTimestamp(value) {
      if (!value) return '-';
      const formatted = this.formatTimestampToYMDHMS(value);
      return formatted && formatted.length ? formatted : '-';
    },
    displayShipField(value) {
      if (value === null || value === undefined) return '-';
      const str = String(value).trim();
      return str.length ? str : '-';
    },
    formatShipCoordinates(ship) {
      if (!ship) return '-';
      const lat = Number(ship.lat);
      const lng = Number(ship.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '-';
      return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
    },
    formatShipSpeed(value) {
      const speed = Number(value);
      if (!Number.isFinite(speed)) return '-';
      return `${speed.toFixed(1)} knots`;
    },
    formatShipHeading(value) {
      const heading = Number(value);
      if (!Number.isFinite(heading)) return '-';
      const normalized = ((heading % 360) + 360) % 360;
      const labels = [
        'Utara',
        'Timur laut',
        'Timur',
        'Tenggara',
        'Selatan',
        'Barat daya',
        'Barat',
        'Barat laut',
      ];
      const index = Math.round(normalized / 45) % labels.length;
      const directionLabel = labels[index];
      return `${normalized.toFixed(1)}° (${directionLabel})`;
    },
    getShipStatusClass(ship) {
      const statusValue = ship && ship.status ? String(ship.status).trim().toLowerCase() : '';
      if (statusValue === 'inactive') return 'ship-status-inactive';
      if (statusValue === 'active') return 'ship-status-active';
      return 'ship-status-unknown';
    },
  async handleFetchHistory({ sn, days, data }) {
      // Convert and render feature-collections (GeoJSON style) for the ship identified by sn
      // Find ship by sn; prefer currently selectedShip
      let shipObj = null;
      if (this.selectedShip && this.selectedShip.sn === sn) shipObj = this.selectedShip;
      else shipObj = this.ships.find(s => s.sn === sn) || null;
      if (!shipObj) {
        console.warn('Ship not found for SN', sn);
        return;
      }
      const shipId = shipObj.id;

      // Ensure storage
      if (!this.trackingByShip[shipId]) this.trackingByShip[shipId] = { markers: [], lines: [] };

      // Clear existing for this ship
      this.hideTracksForShip(shipId);
      this.trackingByShip[shipId].markers = [];
      this.trackingByShip[shipId].lines = [];

      try {
        // Data may be FeatureCollection or array or nested under several keys
        const extractHistoryFeatures = (payload) => {
          if (!payload) return [];
          if (Array.isArray(payload)) return payload;
          if (payload.features && Array.isArray(payload.features)) return payload.features;
          if (payload.data) {
            if (Array.isArray(payload.data.features)) return payload.data.features;
            if (payload.data.history && Array.isArray(payload.data.history.features)) return payload.data.history.features;
          }
          if (payload.history && Array.isArray(payload.history.features)) return payload.history.features;
          return [];
        };

        const features = extractHistoryFeatures(data);

        const toNumber = (value) => {
          if (value === null || value === undefined) return NaN;
          const num = Number(value);
          return Number.isFinite(num) ? num : NaN;
        };

        const extractTimestampValue = (props) => {
          if (!props || typeof props !== 'object') return null;
          return props.timestamp
            ?? props.time
            ?? props.datetime
            ?? props.recorded_at
            ?? props.recordedAt
            ?? props.last_transmitted_at
            ?? props.lastTransmittedAt
            ?? props.last_seen_at
            ?? props.last_update
            ?? props.updated_at
            ?? null;
        };

        const points = [];
        features.forEach((feature) => {
          if (!feature || !feature.geometry) return;
          const geom = feature.geometry;
          const props = feature.properties || {};
          if (geom.type === 'Point') {
            let lng = Array.isArray(geom.coordinates) ? toNumber(geom.coordinates[0]) : NaN;
            let lat = Array.isArray(geom.coordinates) ? toNumber(geom.coordinates[1]) : NaN;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              const pos = Array.isArray(props.position) ? props.position : null;
              if (pos && pos.length >= 2) {
                lat = toNumber(pos[0]);
                lng = toNumber(pos[1]);
              }
            }
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              const coordArr = Array.isArray(props.coordinates) ? props.coordinates : null;
              if (coordArr && coordArr.length >= 2) {
                lat = toNumber(coordArr[0]);
                lng = toNumber(coordArr[1]);
              }
            }
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            points.push({ lat, lng, props, order: points.length, tsRaw: extractTimestampValue(props) });
          } else if (geom.type === 'LineString') {
            const coords = Array.isArray(geom.coordinates) ? geom.coordinates : [];
            coords.forEach((coord) => {
              if (!Array.isArray(coord) || coord.length < 2) return;
              const lng = toNumber(coord[0]);
              const lat = toNumber(coord[1]);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              points.push({ lat, lng, props, order: points.length, tsRaw: extractTimestampValue(props) });
            });
          }
        });

        const toSortableTimestamp = (value, fallback) => {
          if (value === null || value === undefined) return fallback;
          if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
          if (typeof value === 'number' && Number.isFinite(value)) {
            return value < 1e12 ? value * 1000 : value;
          }
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return fallback;
            const numeric = Number(trimmed);
            if (Number.isFinite(numeric)) {
              return numeric < 1e12 ? numeric * 1000 : numeric;
            }
            const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
            const parsed = Date.parse(isoLike);
            if (!Number.isNaN(parsed)) return parsed;
            const digitsOnly = trimmed.replace(/[^0-9]/g, '');
            if (digitsOnly.length > 0) {
              const digitsNum = Number(digitsOnly);
              if (Number.isFinite(digitsNum)) return digitsNum;
            }
            return fallback;
          }
          return fallback;
        };

        // Sort points chronologically when possible; fallback to original order
        points.sort((a, b) => {
          const ta = toSortableTimestamp(a.tsRaw, a.order);
          const tb = toSortableTimestamp(b.tsRaw, b.order);
          if (ta === tb) return a.order - b.order;
          return ta - tb;
        });

        // Create markers and store for slider control
        const latlngs = [];
        this.trackingByShip[shipId].markers = [];
        const exportRows = [];
        points.forEach((p, idx) => {
          const headingRaw = p.props && (p.props.heading ?? p.props.direction ?? p.props.arah ?? p.props.cog ?? p.props.COG);
          const headingDeg = Number.isFinite(Number(headingRaw)) ? Number(headingRaw) : 0;
          const icon = L.divIcon({
            html: `<div class="track-ship-icon" style="--track-heading:${headingDeg}deg">
                     <img src="${kapalMapIcon}" class="track-ship-red" />
                   </div>`,
            className: 'track-ship-red-wrapper',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 200 });
          // Use timestamp/property if present
          const rawTs = p.tsRaw ?? (p.props ? (p.props.timestamp || p.props.time || p.props.datetime) : null);
          const ts = rawTs ? this.formatTimestampToYMDHMS(rawTs) : null;
          const speedVal = p.props && (p.props.kecepatan || p.props.speed || p.props.sog || p.props.SOG);
          const directionVal = p.props && (p.props.direction || p.props.arah || p.props.heading || p.props.cog || p.props.COG);
          const normalizeMetric = (value) => {
            if (value === null || value === undefined || value === '') return null;
            const num = Number(value);
            if (Number.isFinite(num)) return num;
            return value;
          };
          const speed = normalizeMetric(speedVal);
          const direction = normalizeMetric(directionVal);
          const popupHtml = `<div><b>Point ${idx+1}</b>${ts ? `<br>Time: ${ts}` : ''}${speed !== null ? `<br>Speed: ${speed}` : ''}${direction !== null ? `<br>Heading: ${direction}` : ''}<br>Lat: ${p.lat.toFixed(6)}<br>Lng: ${p.lng.toFixed(6)}</div>`;
          marker.bindPopup(popupHtml);
          this.trackingByShip[shipId].markers.push({ marker, lat: p.lat, lng: p.lng, ts, heading: headingDeg });
          latlngs.push([p.lat, p.lng]);

          // Build export row per point
          exportRows.push({
            rangeDays: days,
            vesselName: shipObj.name || '-',
            vesselSn: shipObj.sn || sn,
            timestamp: ts || '',
            lat: p.lat,
            lng: p.lng,
            speed: speed !== null ? speed : '',
            direction: direction !== null ? direction : '',
          });
        });

  // Initialize slider bounds and render full track by default (slider disabled)
  this.trackingSliderMax = latlngs.length > 0 ? latlngs.length - 1 : 0;
  this.trackingSliderIndex = 0;
  this.trackingSliderEnabled = false;
  this.stopAutoPlayInternal();
  this.trackingFullLinePinned = false;
  this.updateTrackingLayers(shipId);

        // Zoom to fit once right after fetch; no auto-zoom changes afterwards
        if (latlngs.length > 0) {
          const bounds = L.latLngBounds(latlngs);
          this.map.fitBounds(bounds.pad(0.2));
        }

  // Mark this ship as actively tracked so Waypoint/ETA buttons hide
        this.trackingActiveShipId = shipId;
        // Set tracking info for overlay
    this.trackingInfo = { sn, days, points: latlngs.length };
    this.trackingInfoByShip[shipId] = { sn, days, points: latlngs.length };
    this.trackingDaysByShip[shipId] = days;
  // Save export rows for download button visibility
  this.trackingExportRows = exportRows;
  this.trackingExportRowsByShip[shipId] = exportRows;

        // Hide existing waypoints and dashed route for this ship while tracking history is active
        this.hideWaypointsForShip(shipId);
        if (this.routeLines && this.routeLines.length) {
          this.routeLines.forEach(line => this.map.removeLayer(line));
          this.routeLines = [];
        }
        this.showWaypointETA = false;
      } catch (err) {
        console.error('Error rendering history data', err);
      }
    },
    handleAddWaypoint(waypointData) {
      if (!this.selectedShip) return;

      const { name, lat, lng } = waypointData;

      // Validate before posting to ensure server acceptance
      const vesselId = this.selectedShip.id;
      const validate = this.validateWaypointInput({ vesselId, name, lat, lng });
      if (!validate.ok) {
        alert('Tidak bisa menyimpan waypoint:\n\n' + validate.errors.map((e,i)=>`• ${e}`).join('\n'));
        return;
      }

      if (!this.waypointsByShip[this.selectedShip.id]) {
        this.waypointsByShip[this.selectedShip.id] = { markers: [], list: [] };
      }

      const marker = L.marker([lat, lng], { 
        icon: this.waypointIcon(),
        zIndexOffset: 200, // Waypoint markers above ship markers
      }).addTo(this.map);
      marker.bindPopup(`<b>${name}</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`, {
        closeButton: true,
        autoPanPadding: [10, 10],
      });

      this.waypointsByShip[this.selectedShip.id].markers.push(marker);
      this.waypointsByShip[this.selectedShip.id].list.push({ name, lat, lng });

      this.map.setView([lat, lng], 10);
      this.updateRouteSummary();
      if (!this.isTrackingActiveForShip(this.selectedShip.id)) {
        this.showWaypointETA = true; // Selalu tampilkan panel ETA saat menambah waypoint
        this.updateRouteLines();
      } else {
        this.showWaypointETA = false;
        this.clearRouteLines();
      }

      // Persist to backend
      this.postWaypointToApi({ vesselId, name, lat, lng }).then(res => {
        if (!res.ok) {
          alert((res.error?.message) || 'Gagal menyimpan waypoint ke server.');
          // If validation error, rollback the local addition to keep UI consistent
          if (res.status === 400) {
            const wpIndex = this.waypointsByShip[this.selectedShip.id].list.length - 1;
            const m = this.waypointsByShip[this.selectedShip.id].markers[wpIndex];
            if (m && this.map.hasLayer(m)) this.map.removeLayer(m);
            this.waypointsByShip[this.selectedShip.id].markers.splice(wpIndex, 1);
            this.waypointsByShip[this.selectedShip.id].list.splice(wpIndex, 1);
            this.updateRouteSummary();
            if (!this.isTrackingActiveForShip(this.selectedShip.id)) {
              this.updateRouteLines();
            } else {
              this.clearRouteLines();
            }
            if (this.waypointsByShip[this.selectedShip.id].list.length === 0) this.showWaypointETA = false;
          } else if (!res.status || res.status >= 500) {
            // If server error, queue for retry
            const payload = res.payload || {
              vessel_id: (vesselId || '').toString().trim(),
              name: this.truncateName24(name),
              coordinate: { latitude: this.formatLatForApi(lat), longitude: this.formatLngForApi(lng) }
            };
            this.queueWaypointPayload(payload);
            console.warn('Waypoint disimpan sementara dan akan dicoba ulang otomatis.', payload);
          }
          return;
        }
        // Optionally refresh from server to ensure canonical list
        this.fetchWaypointsForShipById(vesselId, this.selectedShip.id);
      });
    },
    async handleRemoveWaypoint(index) {
      if (!this.selectedShip || !this.waypointsByShip[this.selectedShip.id]) return;
      const list = this.waypointsByShip[this.selectedShip.id].list;
      const marker = this.waypointsByShip[this.selectedShip.id].markers[index];
      const item = list[index];
      const wpId = item && item.id;
      if (wpId) {
        const ok = window.confirm(`Hapus waypoint "${item.name}" dari database?`);
        if (!ok) return;
        try {
          const url = `https://bcknd.fly.dev/api/v1/waypoint/${encodeURIComponent(wpId)}`;
          const resp = await fetch(url, { method: 'DELETE', headers: { 'Accept': 'application/json' }, credentials: 'include' });
          if (!resp.ok) {
            let msg = '';
            try { const j = await resp.json(); msg = j?.message || j?.error || JSON.stringify(j); } catch (_) { msg = await resp.text().catch(()=>resp.statusText); }
            throw new Error(msg || `HTTP ${resp.status}`);
          }
          if (marker) { if (this.map.hasLayer(marker)) this.map.removeLayer(marker); }
          this.waypointsByShip[this.selectedShip.id].markers.splice(index, 1);
          this.waypointsByShip[this.selectedShip.id].list.splice(index, 1);
          this.updateRouteSummary();
          if (!this.isTrackingActiveForShip(this.selectedShip.id)) {
            this.updateRouteLines();
          } else {
            this.clearRouteLines();
          }
          if (this.waypointsByShip[this.selectedShip.id].list.length === 0) {
            this.showWaypointETA = false;
          }
        } catch (e) {
          alert('Gagal menghapus waypoint dari database.\n\nDetail: ' + (e?.message || 'Unknown error'));
        }
        return;
      }
      // Fallback: jika id tidak tersedia pada item (case lama), tawarkan hapus semua by SN
  const confirmMsg = `Waypoint ini tidak memiliki ID.
Ingin menghapus SEMUA waypoint kapal ini dari database?`;
      if (window.confirm(confirmMsg)) {
        this.handleDeleteWaypointsDbByVesselId(this.selectedShip.id);
      }
    },
    toggleWaypointETA() {
      this.showWaypointETA = !this.showWaypointETA;
    },
    updateRouteSummary() {
      if (!this.selectedShip || !this.waypointsByShip[this.selectedShip.id]) {
        this.waypointSummary = [];
        return;
      }

      const waypoints = this.waypointsByShip[this.selectedShip.id].list;
      const shipLat = this.selectedShip.lat;
      const shipLng = this.selectedShip.lng;
      const speed = this.selectedShip.shipSpeed || this.shipSpeed || 20; // knots

      this.waypointSummary = waypoints.map((waypoint, index) => {
        // Hitung jarak menggunakan formula haversine dalam nautical miles langsung
        const R = 6371; // Radius bumi dalam km
        const dLat = (waypoint.lat - shipLat) * Math.PI / 180;
        const dLng = (waypoint.lng - shipLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(shipLat * Math.PI / 180) * Math.cos(waypoint.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;

        // Konversi ke nautical miles (1 NM = 1.852 km)
        const distanceNm = distanceKm / 1.852;

        // Hitung ETA hanya jika kecepatan > 0
        let eta = null;
        if (speed > 0) {
          const timeHours = distanceNm / speed;
          eta = this.formatETA(timeHours);
        }

        return {
          name: waypoint.name,
          lat: waypoint.lat,
          lng: waypoint.lng,
          distance: distanceNm.toFixed(2),
          eta: eta,
          speed: speed
        };
      });
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
    updateRouteLines() {
      // Hapus garis rute sebelumnya
      this.routeLines.forEach(line => this.map.removeLayer(line));
      this.routeLines = [];

      if (!this.selectedShip || !this.waypointsByShip[this.selectedShip.id]) return;

      const waypoints = this.waypointsByShip[this.selectedShip.id].list;
      if (waypoints.length === 0) return;

      // Buat array koordinat: mulai dari posisi kapal, lalu waypoint-waypoint
      const coords = [[this.selectedShip.lat, this.selectedShip.lng]];
      waypoints.forEach(wp => coords.push([wp.lat, wp.lng]));

      // Gambar garis rute
      const routeLine = L.polyline(coords, {
        color: '#1976d2',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
      }).addTo(this.map);

      // Set z-index for route line to be above markers but below popups
      routeLine.setStyle({ zIndexOffset: 150 });

      this.routeLines.push(routeLine);
    },
    waypointIcon() {
      // Icon bendera merah
      return new L.Icon({
        iconUrl: redFlagIcon,
        iconSize: [32, 32],
        iconAnchor: [16, 32], // Center bottom of flag
        popupAnchor: [0, -32], // Popup above flag
        shadowUrl: "",
        shadowSize: [0, 0],
        className: "",
      });
    },
    exportData() {
      alert("Export data kapal (mock)");
    },
    shipIcon(ship) {
      const statusClass = this.getShipStatusClass(ship);
      const borderColor = ship && ship.colorCode ? ship.colorCode : '#1976d2';
      const heading = ship && Number.isFinite(Number(ship.heading)) ? Number(ship.heading) : 0;
      return L.divIcon({
        html: `<div class="map-ship-icon ${statusClass}" style="--ship-border:${borderColor}; --ship-heading:${heading}deg">
                  <img src="${kapalMapIcon}" alt="Ship" />
                  <span class="ship-status-dot"></span>
               </div>`,
        className: 'map-ship-icon-wrapper',
        iconSize: [36, 48],
        iconAnchor: [18, 44],
        popupAnchor: [0, -32],
      });
    },
    closeWaypointModal() {
      this.showWaypointModal = false;
      this.inputMode = "dms"; // Reset ke mode DMS sebagai default
      this.waypointForm = { name: "", lat: "", lng: "" };
      this.dmsForm = {
        name: "",
        latDeg: 0,
        latMin: 0,
        latSec: 0,
        latDir: "N",
        lngDeg: 0,
        lngMin: 0,
        lngSec: 0,
        lngDir: "E",
      };
    },
    async fetchShips() {
      this.loadingShips = true;
      this.shipsError = null;
      try {
        const dateCandidates = this.getActiveDateCandidates(6);
        let chosenDate = null;
        let fallbackError = null;
        for (const candidate of dateCandidates) {
          const result = await this.fetchShipsForDate(candidate);
          if (!result.ok) {
            fallbackError = result.error;
            continue;
          }
          if (result.ships.length === 0) {
            if (!chosenDate) {
              chosenDate = candidate;
            }
            continue;
          }
          chosenDate = candidate;
          this.lastSuccessfulActiveDate = candidate;
          this.applyShipsDataset(result.ships);
          return;
        }

        if (fallbackError) {
          throw fallbackError;
        }

  const descriptor = chosenDate ? ` untuk tanggal ${chosenDate}` : '';
  this.applyShipsDataset([]);
  this.shipsError = `❕ Tidak ada data kapal yang tersedia${descriptor}. Silakan coba pilih tanggal lain atau hubungi admin untuk memastikan data kapal sudah diunggah.`;
      } catch (error) {
        console.error('❌ Error fetching ships:', error);
        this.shipsError = `❌ Gagal memuat data kapal: ${error.message}

🔍 Kemungkinan penyebab:
• Koneksi internet bermasalah
• API server sedang down
• CORS policy blocking request
• API endpoint berubah

💡 Solusi:
• Cek koneksi internet
• Coba refresh halaman
• Gunakan data cadangan (sudah aktif)`;
        this.lastSuccessfulActiveDate = null;
        // Fallback data MUST comply with SN validation rules:
        //   - Format 9xxxxx (angka 9 diikuti 5 digit).
        // Pastikan data cadangan menggunakan pola SN terbaru.
        this.applyShipsDataset(fallbackShips);
      } finally {
        this.loadingShips = false;
        console.log('🏁 Fetch ships operation completed');
      }
    },
    async testAPIConnection() {
      try {
        console.log('🧪 Testing API connection...');
        const response = await fetch(this.buildVesselListURL({ activeDate: this.lastSuccessfulActiveDate || undefined }), {
          method: 'HEAD', // Just check if endpoint is accessible
          credentials: 'include' // Include cookies for authentication
        });
        console.log('✅ API connection test result:', response.status);
        
        if (response.ok) {
          alert('✅ API Connection OK!\n\nEndpoint dapat diakses dengan baik.\nStatus: ' + response.status);
        } else {
          alert('⚠️ API Connection Issue\n\nEndpoint merespons tapi dengan status error.\nStatus: ' + response.status + '\n\nCoba refresh data kapal.');
        }
        
        return response.ok;
      } catch (error) {
        console.error('❌ API connection test failed:', error);
        alert('❌ API Connection Failed\n\n' + error.message + '\n\nKemungkinan:\n• Tidak ada koneksi internet\n• API server down\n• CORS policy blocking\n• Firewall blocking request\n• Autentikasi diperlukan');
        return false;
      }
    },
    getShipColor(index) {
      const colors = ["#2ecc40", "#ff9800", "#3498db", "#e74c3c", "#9b59b6", "#f39c12", "#1abc9c", "#34495e"];
      return colors[index % colors.length];
    },
    extractAccessibleSerials(user) {
      if (!user || typeof user !== 'object') return [];
      const acc = new Set();
      const add = (v) => { if (v !== null && v !== undefined) { const s = v.toString().trim(); if (s) acc.add(s); } };
      const arrays = [user.vessels, user.ships, user.assignedVessels, user.assigned_ships, user.accessibleVessels, user.accessible_ships];
      for (const arr of arrays) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (typeof item === 'string' || typeof item === 'number') { add(item); continue; }
          if (item && typeof item === 'object') {
            for (const k of ['sn','serial_number','serialNumber','vessel_sn','ship_sn','serial']) {
              if (k in item) { add(item[k]); break; }
            }
          }
        }
      }
      ['sn','serial_number','serialNumber','vessel_sn','ship_sn'].forEach(k => add(user[k]));
      return Array.from(acc);
    },
    async handleLoginSuccess(userData) {
      console.log('Login successful:', userData);
      this.isAuthenticated = true;
      this.adminTab = 'home';

      const candidateUsers = [
        userData?.data?.user,
        userData?.user,
        userData?.session?.user,
        userData?.data?.session?.user,
        userData,
      ];
      const initialUser = candidateUsers.find((item) => item && typeof item === 'object') || null;
      if (initialUser) {
        this.user = initialUser;
      }

      let resolvedUser = initialUser;
      try {
        const session = await authClient.getSession();
        if (session?.data?.user) {
          resolvedUser = session.data.user;
          this.user = resolvedUser;
        }
      } catch (error) {
        console.error('Failed to refresh session after login:', error);
      }

      if (resolvedUser) {
        try {
          localStorage.setItem('basarnas_auth', JSON.stringify({
            user: resolvedUser,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.warn('Unable to persist auth cache:', error);
        }
      }

      // Initialize the map and fetch ships after login
      this.$nextTick(() => {
        this.initializeMap();
        this.fetchShips();
        if (this.map) {
          this.$nextTick(() => this.map.invalidateSize());
        }
      });
    },
    async handleLogout() {
      try {
        // Use Better Auth signOut
        await authClient.signOut();
        
        // Clear local authentication state
        this.isAuthenticated = false;
        this.user = null;
  this.adminTab = 'home';
        
        // Clear localStorage
        localStorage.removeItem('basarnas_auth');
        
        // Clear map and data
        if (this.map) {
          this.map.remove();
          this.map = null;
        }
        this.ships = [];
        this.markers = [];
        this.selectedShip = null;
        this.waypointMarkers = [];
        this.waypointList = [];
        this.waypointsByShip = {};
        this.routeLines = [];
        
        console.log('Logout successful');
      } catch (error) {
        console.error('Logout error:', error);
        // Even if signOut fails, clear local state
        this.isAuthenticated = false;
        this.user = null;
        this.adminTab = 'home';
        localStorage.removeItem('basarnas_auth');
      }
    },
    initializeMap() {
      if (this.map) return; // Prevent re-initialization
      const container = document.getElementById('map');
      if (!container) return;
      this.map = L.map(container, {
        zoomControl: true,
        attributionControl: false,
      }).setView([-2, 118], 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "",
      }).addTo(this.map);

      // Tambahkan skala di pojok kiri bawah
      L.control.scale({ position: "bottomleft", metric: true, imperial: false }).addTo(this.map);

      // Tambahkan event listener untuk zoomend agar popup tetap terbuka saat zoom
      this.map.on('zoomend', () => {
        if (this.selectedShip) {
          const marker = this.markers.find(
            (m) => m.getLatLng().lat === this.selectedShip.lat && m.getLatLng().lng === this.selectedShip.lng
          );
          if (marker && !marker.isPopupOpen()) {
            marker.openPopup();
          }
        }
      });

      // Tambahkan event listener untuk moveend agar markers tetap stabil
      this.map.on('moveend', () => {
        // Force marker repositioning if needed
        this.markers.forEach(marker => {
          if (this.map.hasLayer(marker)) {
            marker.update();
          }
        });
      });
    },
    // Ensure non-admin map height equals admin's by subtracting admin offset plus header block size
    applyUserGridHeight() {
      try {
        if (this.isAdmin) return; // only non-admin
        const root = this.$el;
        if (!root) return;
        const header = root.querySelector('.header');
        const grid = root.querySelector('.grid-layout');
        if (!grid) return;
        const ADMIN_OFFSET = 176; // pixels used by admin to compute grid height
        let headerBlock = 0;
        if (header) {
          const cs = window.getComputedStyle(header);
          const mt = parseInt(cs.marginTop || '0', 10) || 0;
          const mb = parseInt(cs.marginBottom || '0', 10) || 0;
          headerBlock = header.offsetHeight + mt + mb;
        }
        const h = Math.max(280, window.innerHeight - ADMIN_OFFSET - headerBlock);
        grid.style.height = `${h}px`;
        if (this.map) this.map.invalidateSize();
      } catch (_) {
        // no-op
      }
    },
  },
  beforeUnmount() {
    // Clean up timers
    if (this.trackingAutoTimer) {
      clearInterval(this.trackingAutoTimer);
      this.trackingAutoTimer = null;
    }
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    if (this.waypointOutboxTimer) {
      clearInterval(this.waypointOutboxTimer);
      this.waypointOutboxTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.onGlobalButtonClick, false);
    }
  },
  watch: {
    filteredShips() {
      this.$nextTick(() => this.updateShipScrollState());
    },
    search() {
      this.renderShips();
    },
    searchBy() {
      this.renderShips();
    },
    adminTab(newTab) {
      if (newTab === 'home') {
        this.$nextTick(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        });
      }
    },
    selectedShip(newShip, oldShip) {
      // Watcher untuk operasi non-kritis setelah selectedShip berubah
      if (newShip) {
        // Skip auto-zooming when we are refreshing positions or when tracking UI is active
        if (this.isRefreshingShips || (this.trackingActiveShipId && (this.trackingSliderEnabled || this.trackingAutoPlaying))) {
          // Still ensure visibility of waypoints for selected ship without zooming
          setTimeout(() => {
            this.showWaypointsForShip(newShip.id);
            this.updateRouteSummary();
            this.showWaypointETA = this.waypointsByShip[newShip.id] && this.waypointsByShip[newShip.id].list.length > 0;
            this.updateRouteLines();
          }, 0);
          return;
        }
        // Kapal dipilih - jalankan operasi non-kritis
        setTimeout(() => {
          this.map.setView([newShip.lat, newShip.lng], 8);
          this.showWaypointsForShip(newShip.id);

          const marker = this.markers.find(m => m.shipData && m.shipData.id === newShip.id);
          if (marker) marker.openPopup();

          this.scrollToSelectedShip();
          this.updateRouteSummary();
          this.showWaypointETA = this.waypointsByShip[newShip.id] && this.waypointsByShip[newShip.id].list.length > 0;
          this.updateRouteLines();
        }, 0);
      } else if (oldShip) {
        // Kapal di-clear - jalankan cleanup
        setTimeout(() => {
          this.routeLines.forEach((line) => this.map.removeLayer(line));
          this.routeLines = [];
          this.showWaypointETA = false;
          this.waypointSummary = [];
        }, 0);
      }
    },
  },
  
};
</script>

<style>
/* Ensure full background coverage */
html {
  background: #f3f8fa !important;
  min-height: 100vh;
  min-width: 100vw;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background: #f3f8fa !important;
  font-family: 'Inter', Arial, sans-serif;
  margin: 0;
  padding: 0;
  overflow-x: auto; /* Allow horizontal scrolling */
  overflow-y: auto; /* Allow vertical scrolling */
  min-height: 100vh;
  min-width: 100vw;
  width: 100%;
  height: 100%;
}

.main-container {
  background: #f3f8fa !important;
  min-height: 100vh;
  min-width: 100vw; /* Minimum width, but can expand */
  width: 100%; /* Ensure full width coverage */
  height: 100%; /* Ensure full height coverage */
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
.main-container.admin-mode {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
  min-height: 100vh;
  overflow-y: auto;
}

.main-container.admin-mode .admin-toolbar,
.main-container.admin-mode .header,
.main-container.admin-mode .grid-layout,
.main-container.admin-mode .admin-users-panel {
  margin-left: 0;
  margin-right: 0;
}

.main-container.admin-mode .admin-toolbar {
  margin-top: 0;
  position: sticky;
  top: 16px;
  z-index: 20;
}

.main-container.admin-mode .header,
.main-container.admin-mode .grid-layout,
.main-container.admin-mode .admin-users-panel {
  margin-top: 0;
}

.main-container.admin-mode .grid-layout {
  height: calc(100vh - 176px);
}

.admin-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-radius: 20px;
  margin: 16px;
  padding: 16px 24px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
  gap: 16px;
}

.admin-toolbar-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: contain;
}

.admin-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-brand-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.04em;
}

.admin-brand-subtitle {
  font-size: 0.8rem;
  color: #64748b;
}

.admin-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #f1f5f9;
  border-radius: 999px;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-tab:hover {
  background: #e2e8f0;
  color: #1d4ed8;
}

.admin-tab.active {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.25);
}

.tab-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.tab-badge.beta {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.5);
  color: #b45309;
}

.admin-toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-user-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #eff6ff;
  border-radius: 999px;
  padding: 8px 14px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.admin-user-initials {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.admin-user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.admin-user-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
}

.admin-user-role {
  font-size: 0.75rem;
  font-weight: 500;
  color: #2563eb;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-logout {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 999px;
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-logout:hover {
  background: #fecaca;
  color: #7f1d1d;
}

.admin-users-panel {
  margin: 0 16px 16px;
  background: #f8fafc;
  border-radius: 24px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 20px 40px rgba(15, 23, 42, 0.08);
  padding: 24px;
  min-height: calc(100vh - 160px);
  box-sizing: border-box;
}
.main-container:not(.admin-mode) .header {
  position: sticky;
  top: 16px;
  z-index: 20;
}
.main-container:not(.admin-mode) .grid-layout {
  margin-top: 0;
  height: calc(100vh - 176px) !important;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 20px;
  margin: 16px;
  padding: 16px 24px;
  box-shadow: 0 2px 12px #e3e3e3;
  min-width: calc(100vw - 32px); /* Minimum width, can expand */
  max-width: none;
  height: 80px;
  box-sizing: border-box;
}

.header-left {
  display: flex;
  align-items: center;
}

.logout-btn {
  background: #f3f8fa;
  color: #666;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.logout-btn:hover {
  background: #e3e3e3;
  color: #333;
}
.header-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.logo {
  width: 48px;
  height: 48px;
  margin-right: 18px;
  border-radius: 12px;
  object-fit: contain;
  
}
.header-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #222;
  letter-spacing: 1px;
}
.grid-layout {
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  grid-template-rows: 1fr;
  gap: 16px;
  height: calc(100vh - 176px);
  margin: 16px;
  min-width: calc(100vw - 32px); /* Minimum width, can expand */
  width: 100%; /* Ensure full width coverage */
  box-sizing: border-box;
  background: transparent; /* Ensure no background override */
}
.sidebar {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 2px 8px #e3e3e3;
  padding: 16px 12px 12px 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  position: sticky;
  top: 0;
  overflow-y: auto;
}
.sidebar-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #222;
  margin-bottom: 10px;
  text-align: center;
}
.selected-ship-info {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  border: 2px solid #ffffff;
}
.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.info-title {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.close-ship-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
}
.close-ship-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
.ship-details {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 12px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #e3f2fd;
}
.detail-row:last-child {
  border-bottom: none;
}
.detail-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1976d2;
  flex: 1;
}
.detail-value {
  font-size: 0.9rem;
  font-weight: 500;
  color: #222;
  text-align: right;
  flex: 1;
  font-family: 'Courier New', monospace;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.search-input {
  flex: 1;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid #e3e3e3;
  background: #f3f8fa;
  color: #222;
  font-size: 0.98rem;
}
.search-select {
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid #e3e3e3;
  background: #f3f8fa;
  color: #222;
  font-size: 0.95rem;
}
.search-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.ship-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  /* Always show scrollbar and enable click-to-jump */
  scrollbar-width: thin;
  scrollbar-color: #1976d2 #f0f0f0;
}

/* Custom scrollbar for webkit browsers */
.ship-list::-webkit-scrollbar {
  width: 40px;
}

.ship-list::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 6px;
}

.ship-list::-webkit-scrollbar-thumb {
  background: #1976d2;
  border-radius: 16px;
  border: 16px solid #f0f0f0;
}

.ship-list::-webkit-scrollbar-thumb:hover {
  background: #1565c0;
}
.ship-scroll-controls {
  position: absolute;
  right: 100px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}
.ship-scroll-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #e3e3e3;
  background: rgba(255,255,255,0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  color: #1976d2;
  font-weight: 700;
}
.ship-scroll-btn:hover { background: #f3f8fa; }
.ship-scroll-btn:disabled { opacity: .4; cursor: not-allowed; }
.ship-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #e3e3e3;
  cursor: pointer;
  transition: background 0.2s;
}
.ship-item:hover {
  background: #f3f8fa;
}
.ship-item.selected {
  background: #e3f2fd;
  border: 2px solid #1976d2;
  border-radius: 6px;
  margin: 4px 0;
  padding: 10px 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.ship-item.selected .ship-name,
.ship-item.selected .ship-sn {
  color: #1976d2;
  font-weight: 600;
}
.ship-item.selected .ship-sn {
  background: #bbdefb;
  color: #1976d2;
}

.loading-item, .error-item, .empty-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}
.loading-text {
  color: #3498db;
}
.error-text {
  color: #e74c3c;
}
.empty-text {
  color: #95a5a6;
}
.ship-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  color: #1976d2;
  --ship-status-color: #9ca3af;
}
.ship-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.ship-icon::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ship-status-color);
  border: 2px solid rgba(255,255,255,0.9);
  right: -6px;
  top: 0;
  box-shadow: 0 0 4px rgba(0,0,0,0.2);
}
.ship-icon.ship-status-active {
  color: #2ecc40;
  --ship-status-color: #2ecc40;
}
.ship-icon.ship-status-inactive {
  color: #e74c3c;
  --ship-status-color: #e74c3c;
}
.ship-icon.ship-status-unknown {
  color: #6b7280;
  --ship-status-color: #6b7280;
}
.ship-icon-large {
  width: 40px;
  height: 40px;
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  color: #1976d2;
  --ship-status-color: #9ca3af;
}
.ship-icon-large img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.ship-icon-large::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ship-status-color);
  border: 2px solid rgba(255,255,255,0.9);
  right: -6px;
  top: 4px;
  box-shadow: 0 0 4px rgba(0,0,0,0.25);
}
.ship-icon-large.ship-status-active {
  color: #2ecc40;
  --ship-status-color: #2ecc40;
}
.ship-icon-large.ship-status-inactive {
  color: #e74c3c;
  --ship-status-color: #e74c3c;
}
.ship-icon-large.ship-status-unknown {
  color: #6b7280;
  --ship-status-color: #6b7280;
}
.ship-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
}

.ship-name {
  font-weight: 600;
  color: #222;
  font-size: 0.95rem;
  line-height: 1.2;
  margin-left: 40px;
  text-align: left;
}

.ship-sn {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
  font-family: monospace;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1.2;
  width: fit-content;
  margin-left: 40px;
  margin-top: 2px;
  align-self: flex-start;
}
.sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  font-size: 0.98rem;
  color: #222;
}
.total-data {
  font-weight: 600;
  margin-left: 8px;
}
.export-btn {
  background: #e3f7e3;
  color: #2ecc40;
  border: none;
  border-radius: 8px;
  padding: 5px 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 4px #e3e3e3;
  transition: background 0.2s;
  font-size: 0.98rem;
}
.export-btn:hover {
  background: #c8f7c5;
}
.refresh-btn {
  background: #e3f2fd;
  color: #2196f3;
  border: none;
  border-radius: 8px;
  padding: 5px 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 4px #e3e3e3;
  transition: background 0.2s;
  font-size: 0.98rem;
  margin-right: 8px;
}
.refresh-btn:hover:not(:disabled) {
  background: #bbdefb;
}
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.test-api-btn {
  background: #fff3cd;
  color: #856404;
  border: none;
  border-radius: 8px;
  padding: 5px 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 4px #e3e3e3;
  transition: background 0.2s;
  font-size: 0.98rem;
  margin-right: 8px;
}
.test-api-btn:hover:not(:disabled) {
  background: #ffeaa7;
}
.test-api-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.map-container {
  position: relative;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 2px 8px #e3e3e3;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 100%; /* Can expand beyond container */
  width: auto; /* Allow natural width */
  overflow: hidden; /* Prevent map from causing background issues */
}
#map {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 100%;
  border-radius: 20px;
}
.map-ship-icon-wrapper {
  width: 36px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.map-ship-icon {
  position: relative;
  width: 36px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  --ship-status-color: #9ca3af;
  --ship-border: #1976d2;
}
.map-ship-icon img {
  width: 28px;
  height: 44px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
  transform: rotate(var(--ship-heading, 0deg));
  transform-origin: 50% 60%;
}
.map-ship-icon::before {
  content: '';
  position: absolute;
  bottom: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--ship-border);
  opacity: 0.35;
}
.map-ship-icon .ship-status-dot {
  position: absolute;
  bottom: 4px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ship-status-color);
  border: 2px solid #ffffff;
  box-shadow: 0 0 4px rgba(0,0,0,0.3);
}
.map-ship-icon.ship-status-active {
  --ship-status-color: #2ecc40;
}
.map-ship-icon.ship-status-inactive {
  --ship-status-color: #e74c3c;
}
.map-ship-icon.ship-status-unknown {
  --ship-status-color: #6b7280;
}
.summary-btn-container {
  position: absolute;
  right: 16px;
  bottom: 56px; /* place above the copyright which sits at bottom:16px */
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* .upload-btn-container no longer used */

.kmlkmz-global-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #dc2626;
  color: #ffffff;
  padding: 14px 22px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  z-index: 1200;
  max-width: 60%;
  text-align: center;
  line-height: 1.4;
  animation: kmlkmzFade 0.3s ease-out;
}
.kmlkmz-global-success {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #16a34a;
  color: #ffffff;
  padding: 14px 22px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  z-index: 1200;
  max-width: 60%;
  text-align: center;
  line-height: 1.4;
  animation: kmlkmzFade 0.2s ease-out;
}
@keyframes kmlkmzFade {
  from { opacity: 0; transform: translate(-50%, -55%); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

.copyright {
  position: absolute;
  right: 16px;
  bottom: 16px;
  font-size: 0.9rem;
  color: #888;
  background: rgba(255,255,255,0.9);
  padding: 6px 12px;
  border-radius: 8px;
  z-index: 999;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 8px;
}
.waypoint-actions {
  position: absolute;
  right: 24px;
  bottom: 56px;
  display: flex;
  gap: 10px;
  z-index: 1000;
}
.waypoint-btn {
  background: #222;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 10px 22px;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 2px 8px #e3e3e3;
  cursor: pointer;
  opacity: 0.95;
}
.waypoint-btn:hover {
  background: #444;
}
.waypoint-eta-btn {
  background: #fff;
  color: #222;
  border: 1px solid #e3e3e3;
  border-radius: 12px;
  padding: 10px 18px 10px 10px;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px #e3e3e3;
  cursor: pointer;
}
.waypoint-eta-btn:hover {
  background: #f3f8fa;
}
.eta-icon {
  width: 22px;
  height: 22px;
}

.tracking-btn {
  background: #fff;
  color: #222;
  border: 1px solid #e3e3e3;
  border-radius: 12px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px #e3e3e3;
  cursor: pointer;
}
.tracking-btn:hover { background: #f3f8fa; }
.history-icon { width: 24px; height: 24px; border-radius: 6px; }

/* Summary waypoint button */
.summary-btn {
  background: #fff;
  color: #222;
  border: 1px solid #e3e3e3;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  padding: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px #e3e3e3;
  cursor: pointer;
}
.summary-btn:hover { background: #f8f9fa; }
.summary-icon { width: 35px; height: 35px; border-radius: 4px; }

.tracking-range {
  -webkit-appearance: none;
  appearance: none;
  width: 180px;
  height: 8px;
  border-radius: 6px;
  background: #e3e3e3;
  outline: none;
  margin-right: 8px;
}
.tracking-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #000000;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.tracking-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1976d2;
  cursor: pointer;
}

.tracking-range-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #111;
  font-size: 0.85rem;
  margin-right: 8px;
}
.tracking-range-meta .meta-line { display: flex; gap: 6px; align-items: baseline; }
.tracking-range-meta .meta-label { color: #666; }
.tracking-range-meta .meta-value { color: #1976d2; font-weight: 600; font-family: 'Courier New', monospace; }

/* Red-tinted ship icon for tracking points */
.track-ship-red-wrapper { background: transparent !important; border: none !important; }
.track-ship-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(var(--track-heading, 0deg));
  transform-origin: 50% 60%;
}
.track-ship-red {
  width: 36px;
  height: 40px;
  display: block;
  /* Apply a strong red tint to the base ship icon */
  /* This filter combination yields a vivid red on most neutral/blue bases */
  filter: invert(17%) sepia(86%) saturate(7477%) hue-rotate(1deg) brightness(99%) contrast(113%);
}

.tracking-info {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255,255,255,0.95);
  padding: 10px 14px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  z-index: 1201;
  font-size: 0.95rem;
  color: #111;
}
.tracking-info .ti-row { margin-bottom: 6px; }
.tracking-info .ti-row strong { color: #1976d2; }

/* Smooth scrolling for better UX */
html {
  scroll-behavior: smooth;
}

/* Download button bottom-left */
.tracking-download {
  position: absolute;
  left: 12px;
  bottom: 48px; /* above Leaflet scale control */
  z-index: 1201;
}
.tracking-download .download-btn {
  background: #737373;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.tracking-download .download-btn:hover {
  background: #121212;
}

/* Handle very wide screens */
@media (min-width: 1920px) {
  .grid-layout {
    max-width: 1800px; /* Limit max width on ultra-wide screens */
    margin: 16px auto; /* Center the layout */
  }
  
  .header {
    max-width: 1800px;
    margin: 16px auto;
  }
}

/* Ensure content doesn't break on very small screens */
@media (max-width: 320px) {
  .grid-layout {
    margin: 8px;
    min-width: calc(100vw - 16px);
  }
  
  .header {
    margin: 8px;
    min-width: calc(100vw - 16px);
  }
}

/* Ensure complete background coverage for all content areas */
* {
  box-sizing: border-box;
}

/* Prevent any background bleed-through */
html, body, .main-container {
  background-attachment: fixed;
  background-repeat: no-repeat;
  background-size: cover;
}

/* Ensure all containers have white background */
.grid-layout {
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  grid-template-rows: 1fr;
  gap: 16px;
  height: calc(100vh - 176px);
  margin: 16px;
  min-width: calc(100vw - 32px); /* Minimum width, can expand */
  width: 100%; /* Ensure full width coverage */
  box-sizing: border-box;
  background: transparent; /* Ensure no background override */
}

/* Force white background on all major containers */
.sidebar, .map-container {
  background: #fff !important;
}

/* Ensure no transparent backgrounds anywhere */
* {
  box-sizing: border-box;
}

/* Additional background coverage for edge cases */
html::before,
body::before,
.main-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #f3f8fa;
  z-index: -1;
  pointer-events: none;
}

/* Ensure viewport coverage on all sides */
html, body {
  position: relative;
}

html::after,
body::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f3f8fa;
  z-index: -2;
  pointer-events: none;
}

/* Override for specific elements that need white background */
html,
body,
.main-container {
  background-color: #f3f8fa !important;
}

.sidebar,
.map-container,
.header,
.modal-overlay,
.waypoint-eta-panel {
  background-color: #fff !important;
}
</style>
