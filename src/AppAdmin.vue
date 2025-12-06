<template>
  <div class="main-container">
    <!-- Header styled like AppUser with embedded admin tabs -->
    <header class="header" style="width: 100%; box-sizing: border-box;">
      <div class="header-left">
        <img src="/Users/rafiyahyaacpridan/Documents/layout_basarnas/src/assets/basarnas.png" class="logo" alt="Basarnas" />
        <span class="header-title">SISTEM MONITORING</span>
        <div class="admin-tabs" style="margin-left: 20px;">
          <button type="button" class="admin-tab" :class="{ active: vm.adminTab === 'home' }" @click="vm.adminTab = 'home'">
            <span>Home</span>
            <span class="tab-badge beta">Beta</span>
          </button>
          <button type="button" class="admin-tab" :class="{ active: vm.adminTab === 'users' }" @click="vm.adminTab = 'users'">
            <span>Users</span>
            <span class="tab-badge beta">Beta</span>
          </button>
        </div>
      </div>
      <div class="header-right">
        <div class="admin-user-pill">
          <div class="admin-user-initials">{{ vm.currentUserName ? vm.currentUserName.charAt(0).toUpperCase() : 'P' }}</div>
          <div class="admin-user-meta">
            <span class="admin-user-name">{{ vm.currentUserName }}</span>
            <span class="admin-user-role">{{ vm.currentRoleLabel }}</span>
          </div>
        </div>
        <button class="admin-logout" type="button" @click="vm.handleLogout" title="Logout">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z" />
            <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Home Tab (Map + Sidebar) -->
    <div class="grid-layout" v-show="vm.adminTab === 'home'">
      <!-- Sidebar -->
      <aside class="sidebar">
        <h3 class="sidebar-title">Daftar Kapal</h3>

        <!-- Selected Ship Info -->
        <div v-if="vm.selectedShip" class="selected-ship-info">
          <div class="info-header">
            <h4 class="info-title">
              <span class="ship-icon-large" :class="vm.getShipStatusClass(vm.selectedShip)">
                <img :src="vm.kapalIconUrl" alt="Ship" />
              </span>
              Panel Informasi Kapal
            </h4>
            <button @click="vm.clearSelectedShip" class="close-ship-btn" title="Tutup panel kapal">×</button>
          </div>
          <div class="ship-details">
            <div class="detail-row">
              <span class="detail-label">Nama Kapal:</span>
              <span class="detail-value">{{ vm.selectedShip.name }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Serial Number:</span>
              <span class="detail-value">{{ vm.selectedShip.sn }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Koordinat:</span>
              <span class="detail-value">{{ vm.formatShipCoordinates(vm.selectedShip) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Kecepatan:</span>
              <span class="detail-value">{{ vm.formatShipSpeed(vm.selectedShip.shipSpeed) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Arah Kapal:</span>
              <span class="detail-value">{{ vm.formatShipHeading(vm.selectedShip.heading) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Device:</span>
              <span class="detail-value">{{ vm.displayShipField(vm.selectedShip.dataSource) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Sumber Daya:</span>
              <span class="detail-value">{{ vm.displayShipField(vm.selectedShip.powerSource) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Last Transmitted:</span>
              <span class="detail-value">{{ vm.formatShipTimestamp(vm.selectedShip.lastTransmittedAtDisplay || vm.selectedShip.lastTransmittedAt) }}</span>
            </div>
          </div>
        </div>

        <div class="search-row">
          <div style="position: relative; width: 100%; display: flex; align-items: center;">
            <input v-model="vm.search" :placeholder="vm.searchPlaceholder" class="search-input" style="width: 100%;" />
            <button v-if="vm.search" @click="vm.search = ''" title="Hapus pencarian" style="position: absolute; right: -15px; top: -5px; height: 100%; background: none; border: none; color: #888; font-size: 18px; cursor: pointer; outline: none;">×</button>
          </div>
          <select v-model="vm.searchBy" class="search-select">
            <option value="name">By Name</option>
            <option value="sn">By SN</option>
          </select>
          <button class="search-btn">
            <svg width="18" height="18" fill="#6c757d"><circle cx="8" cy="8" r="7" stroke="#6c757d" stroke-width="2" fill="none"/><line x1="13" y1="13" x2="17" y2="17" stroke="#6c757d" stroke-width="2"/></svg>
          </button>
        </div>

        <ul class="ship-list">
          <li v-if="vm.loadingShips" class="loading-item"><span class="loading-text">Memuat data kapal...</span></li>
          <li v-else-if="vm.shipsError" class="error-item"><span class="error-text">{{ vm.shipsError }}</span></li>
          <li v-else-if="vm.filteredShips.length === 0" class="empty-item"><span class="empty-text">Tidak ada kapal ditemukan</span></li>
          <li v-else v-for="ship in vm.filteredShips" :key="ship.id" @click="vm.focusShip(ship)" class="ship-item" :class="{ 'selected': vm.selectedShip && vm.selectedShip.id === ship.id }">
            <span class="ship-icon" :class="vm.getShipStatusClass(ship)">
              <img :src="vm.kapalIconUrl" alt="Ship" />
            </span>
            <div class="ship-info">
              <div class="ship-name">{{ ship.name }}</div>
              <div class="ship-sn">{{ ship.sn }}</div>
            </div>
          </li>
        </ul>
        <div class="sidebar-footer">
          <span>Total Data</span>
          <span class="total-data">{{ vm.loadingShips ? '...' : vm.ships.length }}</span>
          <button class="refresh-btn" @click="vm.fetchShips" :disabled="vm.loadingShips" title="Refresh Data Kapal">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 0-.384-.41z"/>
              <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
            </svg>
          </button>
          <button class="test-api-btn" @click="vm.testAPIConnection" title="Test API Connection">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 0 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          </button>
          <DownloadExcel :data="vm.shipExportRows" :fields="vm.shipExportFields" :name="vm.shipExportFileName" type="xls">
            <button class="export-btn" :disabled="vm.loadingShips || vm.shipExportRows.length === 0">Export</button>
          </DownloadExcel>
        </div>
      </aside>

      <!-- Map Container + Controls -->
      <div class="map-container">
        <div id="map"></div>
        <div class="waypoint-actions">
          <button v-if="vm.selectedShip && vm.selectedShip.id !== vm.trackingActiveShipId" class="waypoint-btn" @click="vm.showWaypointModal = true">Waypoint</button>
          <button v-if="vm.selectedShip && vm.selectedShip.id !== vm.trackingActiveShipId" class="waypoint-eta-btn" @click="vm.toggleWaypointETA">
            <img src="./assets/flag.png" alt="Waypoint ETA" class="eta-icon" />
          </button>
          <input v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && vm.trackingSliderEnabled" type="range" class="tracking-range" :min="0" :max="vm.trackingSliderMax" v-model.number="vm.trackingSliderIndex" @input="vm.onTrackingSliderInput" title="Time Slider" />
          <div v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && vm.trackingSliderEnabled" class="tracking-range-meta">
            <div class="meta-line"><span class="meta-label">Waktu:</span><span class="meta-value">{{ vm.trackingCurrentTime || '-' }}</span></div>
            <div class="meta-line"><span class="meta-label">Titik ke-</span><span class="meta-value">{{ vm.trackingCurrentCount }}</span></div>
          </div>
          <button v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && vm.trackingSliderEnabled" class="tracking-btn tracking-cancel-btn" @click="vm.cancelTrackingSlider" title="Cancel Range Slider">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.42L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"/></svg>
          </button>
          <button v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && vm.trackingSliderEnabled && !vm.trackingAutoPlaying && !vm.trackingPlaybackComplete" class="tracking-btn tracking-play-btn" @click="vm.startAutoPlay" title="Play">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7L8 5z"/></svg>
          </button>
          <button v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && vm.trackingSliderEnabled && !vm.trackingAutoPlaying && vm.trackingPlaybackComplete" class="tracking-btn tracking-replay-btn" @click="vm.rewatchAutoPlay" title="Rewatch">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 5a7 7 0 1 0 6.32 10H16a1 1 0 0 1 0-2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-2 0v-1.24A9 9 0 1 1 12 3a1 1 0 0 1 0 2z"/></svg>
          </button>
          <button v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && vm.trackingSliderEnabled && vm.trackingAutoPlaying" class="tracking-btn tracking-pause-btn" @click="vm.pauseAutoPlay" title="Pause">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          </button>
          <button v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingSliderMax > 0 && !vm.trackingSliderEnabled" class="tracking-btn tracking-play-btn" @click="vm.enableSliderAndPlay" title="Play">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7L8 5z"/></svg>
          </button>
          <button v-if="vm.selectedShip" class="tracking-btn" @click="vm.showTrackingHistory = true" title="Tracking History">
            <img src="./assets/history.jpeg" alt="History" class="history-icon" />
          </button>
        </div>

        <div v-if="!vm.selectedShip" class="summary-btn-container">
          <KmlKmzUpload :map="vm.map" :proxyUrl="vm.kmlProxyUrl" @error="vm.handleKmlKmzError" @success="vm.handleKmlKmzSuccess" />
          <button class="summary-btn" @click="vm.showSummaryWaypoint = true" title="Summary Waypoint">
            <img src="./assets/summaryWaypoint.png" alt="Summary Waypoint" class="summary-icon" />
          </button>
        </div>
        <!-- Floating SOS control bottom-right -->
        <SOS mode="admin" :ships="vm.ships" :selected-ship="vm.selectedShip" :allowed-sns="[]" />
        <span class="copyright">Copyright Basarnas © 2025</span>
        <div v-if="vm.hasGlobalKmlKmzError" class="kmlkmz-global-error">{{ vm.globalKmlKmzError }}</div>
        <div v-if="vm.hasGlobalKmlKmzSuccess" class="kmlkmz-global-success">{{ vm.globalKmlKmzSuccess }}</div>

        <Waypoint :showModal="vm.showWaypointModal" @add-waypoint="vm.handleAddWaypoint" @close-modal="vm.showWaypointModal = false" />
        <WaypointETA :showETA="vm.showWaypointETA" :selectedShip="vm.selectedShip" :waypointSummary="vm.waypointSummary" @toggle-eta="vm.toggleWaypointETA" @remove-waypoint="vm.handleRemoveWaypoint" />
        <TrackingHistoryKapal :show="vm.showTrackingHistory" :sn="vm.selectedShip ? vm.selectedShip.sn : ''" :vessel-id="vm.selectedShip ? (vm.selectedShip.vessel_id || vm.selectedShip.id || '') : ''" :vessel-name="vm.selectedShip ? vm.selectedShip.name : ''" :initial-days="vm.getTrackingDays(vm.selectedShip ? vm.selectedShip.id : null)" @fetch-history="vm.handleFetchHistory" @close="vm.showTrackingHistory = false" />
        <SummaryWaypoint :show="vm.showSummaryWaypoint" :ships="vm.ships" :waypointsByShip="vm.waypointsByShip" :defaultSpeed="vm.shipSpeed" @select-ship="vm.handleSelectShipFromSummary" @close="vm.showSummaryWaypoint = false" />

        <div v-if="vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId && vm.trackingExportRows && vm.trackingExportRows.length > 0" class="tracking-download">
          <DownloadExcel :data="vm.trackingExportRows" :fields="vm.trackingExportFields" :name="vm.trackingExportFileName" type="xls">
            <button type="button" class="download-btn" title="Download Analisa Tracking">Download Analisa Tracking</button>
          </DownloadExcel>
        </div>

        <div v-if="vm.trackingInfo && vm.selectedShip && vm.selectedShip.id === vm.trackingActiveShipId" class="tracking-info">
          <div class="ti-row">Jumlah Koordinat: <strong>{{ vm.trackingInfo.points }}</strong></div>
          <div class="ti-row">Days: <strong>{{ vm.trackingInfo.days }}</strong></div>
        </div>
      </div>
    </div>

    <!-- Users Tab -->
    <div v-if="vm.adminTab === 'users'" class="admin-users-panel" style="width: 100%; box-sizing: border-box;">
      <AdminUsersPage :current-user="vm.user" :total-ships="vm.ships.length" />
    </div>
  </div>
</template>

<script>
import Waypoint from "./components/Waypoint.vue";
import WaypointETA from "./components/WaypointETA.vue";
import TrackingHistoryKapal from "./components/TrackingHistoryKapal.vue";
import SummaryWaypoint from "./components/SummaryWaypoint.vue";
import AdminUsersPage from "./components/AdminUsersPage.vue";
import KmlKmzUpload from "./components/KmlKmzUpload.vue";
import SOS from "./components/SOS.vue";
import JsonExcel from 'vue-json-excel3';

export default {
  name: 'AppAdmin',
  props: {
    vm: { type: Object, required: true }
  },
  components: {
    Waypoint,
    WaypointETA,
    TrackingHistoryKapal,
    SummaryWaypoint,
    AdminUsersPage,
    KmlKmzUpload,
    SOS,
    DownloadExcel: JsonExcel,
  }
};
</script>
