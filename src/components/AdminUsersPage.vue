<template>
  <div class="admin-users-page">
    <header class="users-header">
      <div class="header-left">
        <div class="title-block">
          <span class="title-label">Users</span>
          <span class="status-badge beta">Beta</span>
        </div>
        <p class="header-description">
          Kelola akun administrator dan operator sistem monitoring kapal.
        </p>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="refresh-button"
          :disabled="isLoading"
          @click="fetchUsers"
          title="Refresh data pengguna"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 8a5.5 5.5 0 0 1 9.357-3.857L10.5 5.5H14V2l-1.305 1.305A7 7 0 0 0 1 8a7 7 0 0 0 11.863 4.872.5.5 0 0 0-.73-.684A5.998 5.998 0 0 1 2.5 8Z" fill="currentColor"/>
          </svg>
          <span>{{ isLoading ? 'Memuat...' : 'Refresh' }}</span>
        </button>
        <button type="button" class="primary-button" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1.5a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5a.5.5 0 0 1 .5-.5Z" fill="currentColor"/>
          </svg>
          <span>Create User</span>
        </button>
      </div>
    </header>

    <div v-if="globalError" class="global-alert error">
      <span>{{ globalError }}</span>
      <button type="button" class="alert-close" @click="globalError = ''">&times;</button>
    </div>
    <div v-if="globalSuccess" class="global-alert success">
      <span>{{ globalSuccess }}</span>
      <button type="button" class="alert-close" @click="globalSuccess = ''">&times;</button>
    </div>

    <section class="filters-card">
      <div class="filter-input">
  <label class="filter-label" for="search-users">Filter nama atau email</label>
        <div class="input-with-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.9 14.32a7 7 0 1 1 1.414-1.414l3.387 3.387a1 1 0 0 1-1.414 1.414L12.9 14.32Z" stroke="#64748b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" stroke="#64748b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input
            id="search-users"
            v-model.trim="searchTerm"
            type="text"
            placeholder="Cari nama atau email"
          />
        </div>
      </div>
      <div class="filter-select">
        <label class="filter-label" for="role-filter">Role</label>
        <select id="role-filter" v-model="roleFilter">
          <option value="">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>
    </section>

    <section class="users-table-card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="text-left">Name</th>
              <th class="text-left">Email</th>
              <th class="text-left">Role</th>
              <th class="text-left">Jumlah Kapal</th>
              <th class="text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="5" class="table-placeholder">Memuat data pengguna...</td>
            </tr>
            <tr v-else-if="pagedUsers.length === 0">
              <td colspan="5" class="table-placeholder">Tidak ada pengguna yang cocok dengan filter.</td>
            </tr>
            <tr v-for="userRecord in pagedUsers" :key="userRecord.id || userRecord.email">
              <td>
                <span class="cell-text">{{ userRecord.name || userRecord.full_name || userRecord.fullName || '-' }}</span>
              </td>
              <td>
                <span class="cell-text">{{ userRecord.email || '-' }}</span>
              </td>
              <td>
                <span class="role-badge" :class="roleBadgeClass(userRecord.role)">{{ formatRole(userRecord.role) }}</span>
              </td>
              <td>
                <span class="cell-text">
                  <!-- Untuk role user tampilkan jumlah kapal dari label DB -->
                  {{ isManageableUser(userRecord.role) ? labelShipCountForUser(userRecord) : shipCountFor(userRecord) }}
                </span>
              </td>
              <td class="actions-cell">
                <button type="button" class="menu-btn" title="Edit User" @click="openEditModal(userRecord)">
                  <img :src="DotsIcon" alt="Menu" width="18" height="18" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="table-footer" v-if="!isLoading">
        <div class="rows-control">
          <label for="rows-per-page">Rows</label>
          <select id="rows-per-page" v-model.number="rowsPerPage">
            <option v-for="size in rowOptions" :key="size" :value="size">{{ size }}</option>
          </select>
        </div>
        <div class="pagination">
          <button type="button" @click="goToPreviousPage" :disabled="currentPage === 1">&laquo;</button>
          <span>Page {{ currentPage }} dari {{ totalPages }}</span>
          <button type="button" @click="goToNextPage" :disabled="currentPage >= totalPages">&raquo;</button>
        </div>
      </footer>
    </section>

    <transition name="fade">
      <div v-if="showCreateModal" class="modal-backdrop" @click.self="closeCreateModal">
        <div class="modal-card">
          <header class="modal-header">
            <div>
              <h3>Buat Akun Baru</h3>
              <p>Masukkan detail akun yang akan dibuat.</p>
            </div>
            <button type="button" class="modal-close close-ship-btn" @click="closeCreateModal" aria-label="Tutup">&times;</button>
          </header>
          <form class="modal-form" @submit.prevent="handleCreateUser">
            <div class="form-grid">
              <div class="form-field">
                <label for="form-name">Name</label>
                <input id="form-name" v-model.trim="form.name" type="text" placeholder="nama atau username" required />
              </div>
              <div class="form-field">
                <label for="form-email">Email</label>
                <input id="form-email" v-model.trim="form.email" type="email" placeholder="email@contoh.com" required />
              </div>
              <div class="form-field">
                <label for="form-password">Password</label>
                <input id="form-password" v-model="form.password" type="password" placeholder="Minimal 6 karakter" required />
              </div>
              <div class="form-field">
                <label for="form-role">Role</label>
                <select id="form-role" v-model="form.role" required>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
            </div>

            <div v-if="formError" class="modal-alert error">{{ formError }}</div>
            <div v-if="formSuccess" class="modal-alert success">{{ formSuccess }}</div>

            <div class="modal-actions">
              <button type="button" class="secondary-button" @click="closeCreateModal" :disabled="formSubmitting">Batal</button>
              <button type="submit" class="primary-button" :disabled="formSubmitting">
                <span v-if="formSubmitting" class="spinner"></span>
                <span>{{ formSubmitting ? 'Menyimpan...' : 'Simpan' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="showEditModal" class="modal-backdrop" @click.self="closeEditModal">
        <div class="modal-card">
          <header class="modal-header">
            <div>
              <h3>Edit Akun</h3>
              <p>Perbarui data pengguna.</p>
            </div>
            <button type="button" class="modal-close close-ship-btn" @click="closeEditModal" aria-label="Tutup">&times;</button>
          </header>
          <form class="modal-form" @submit.prevent="handleUpdateUser">
            <div class="form-grid">
              <div class="form-field">
                <label for="edit-name">Name</label>
                <input id="edit-name" v-model.trim="editForm.name" type="text" placeholder="Nama lengkap" required />
              </div>
              <div class="form-field">
                <label for="edit-email">Email</label>
                <input id="edit-email" v-model.trim="editForm.email" type="email" placeholder="email@contoh.com" required />
              </div>
              <div class="form-field">
                <label for="edit-role">Role</label>
                <select id="edit-role" v-model="editForm.role" required>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
              <!-- Tombol Kelola akses kapal dipindahkan ke dalam modal edit akun untuk role user -->
              <div class="form-field" v-if="isManageableUser(editForm.role)">
                <label>Akses Kapal</label>
                <button type="button" class="assign-button" @click="openVesselDrawer(editForm)" :disabled="editSubmitting">
                  Kelola Akses Kapal
                </button>
                <p class="helper-text" v-if="extractSerialsFromRecord(editForm).length > 0">
                  {{ extractSerialsFromRecord(editForm).length }} kapal terhubung.
                </p>
              </div>
              <!-- Khusus admin: Assign Kapal Device (SN tanpa vessel_id ke vessel yang memiliki ID) -->
              <div class="form-field" v-if="normalizeRoleValue(editForm.role)==='admin'">
                <label>Assign Kapal Device</label>
                <button type="button" class="assign-button" @click="openDeviceAssignDrawer(editForm)" :disabled="editSubmitting">
                  Assign Kapal
                </button>
                <p class="helper-text">Hubungkan perangkat (SN) yang belum memiliki vessel_id ke kapal yang sudah terdaftar.</p>
              </div>
            </div>

            <div v-if="editError" class="modal-alert error">{{ editError }}</div>
            <div v-if="editSuccess" class="modal-alert success">{{ editSuccess }}</div>

            <div class="modal-actions">
              <button type="button" class="secondary-button" @click="closeEditModal" :disabled="editSubmitting">Batal</button>
              <button type="submit" class="primary-button" :disabled="editSubmitting">
                <span v-if="editSubmitting" class="spinner"></span>
                <span>{{ editSubmitting ? 'Menyimpan...' : 'Simpan' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showVesselDrawer"
        class="drawer-backdrop"
        @click.self="closeVesselDrawer"
      >
        <aside class="drawer-panel">
          <header class="drawer-header">
            <div class="drawer-title-group">
              <h3>Kelola Akses Kapal</h3>
              <p v-if="drawerUserName" class="drawer-subtitle">{{ drawerUserName }}</p>
            </div>
            <button type="button" class="drawer-close" @click="closeVesselDrawer">&times;</button>
          </header>

          <div class="drawer-section">
            <div class="drawer-alert error" v-if="vesselAssignError">{{ vesselAssignError }}</div>
            <div class="drawer-alert success" v-if="vesselAssignSuccess">{{ vesselAssignSuccess }}</div>
          </div>

          <div class="drawer-section drawer-controls">
            <div class="drawer-search">
              <input
                type="text"
                v-model.trim="vesselSearch"
                placeholder="Cari kapal berdasarkan nama atau SN"
                :disabled="vesselLoading"
              />
              <button
                type="button"
                class="drawer-icon-btn"
                :disabled="vesselLoading"
                title="Refresh daftar kapal"
                @click="fetchVessels(true)"
              >
                &#8635;
              </button>
            </div>
            <span class="drawer-count" v-if="!vesselLoading">{{ filteredVessels.length }} kapal</span>
          </div>

          <div class="drawer-body">
            <div v-if="vesselLoading" class="drawer-placeholder">Memuat daftar kapal...</div>
            <template v-else>
              <div v-if="selectedVesselDetails.length" class="drawer-selected-list">
                <div class="drawer-selected-header">
                  <h4>Akses saat ini</h4>
                  <span>{{ selectedVesselDetails.length }} kapal</span>
                </div>
                <ul class="drawer-selected-items">
                  <li v-for="item in selectedVesselDetails" :key="item.sn" class="drawer-selected-item">
                    <div class="drawer-selected-info">
                      <span class="drawer-selected-name">{{ item.name }}</span>
                      <span class="drawer-selected-sn">SN: {{ item.sn }}</span>
                    </div>
                  </li>
                </ul>
              </div>

              <div class="drawer-available-block">
                <h4>Tambah akses kapal</h4>
                <div v-if="vesselError" class="drawer-placeholder error">{{ vesselError }}</div>
                <div v-else-if="filteredVessels.length === 0" class="drawer-placeholder">Tidak ada kapal tersedia.</div>
                <ul v-else class="drawer-ship-list">
                  <li v-for="ship in filteredVessels" :key="ship.id || ship.sn" class="drawer-ship-item">
                    <label class="drawer-ship-label">
                      <input
                        type="checkbox"
                        :value="ship.sn"
                        :checked="false"
                        @change="toggleShipSelection(ship.sn, $event.target.checked)"
                      />
                      <div class="drawer-ship-info">
                        <span class="drawer-ship-name">{{ ship.name }}</span>
                        <span class="drawer-ship-sn">SN: {{ ship.sn }}</span>
                      </div>
                    </label>
                  </li>
                </ul>
              </div>
            </template>
          </div>

          <footer class="drawer-footer">
            <div class="drawer-selected">
              <strong>{{ vesselSelectedSNs.length }}</strong>
              <span>dipilih</span>
            </div>
            <div class="drawer-actions">
              <button type="button" class="secondary-button" @click="closeVesselDrawer" :disabled="vesselAssignSubmitting">Batal</button>
              <button type="button" class="primary-button" @click="submitVesselAssignments" :disabled="vesselAssignSubmitting">
                <span v-if="vesselAssignSubmitting" class="spinner"></span>
                <span>{{ vesselAssignSubmitting ? 'Menyimpan...' : 'Simpan' }}</span>
              </button>
            </div>
          </footer>
        </aside>
      </div>
    </transition>

    <!-- Drawer Assign Device to Vessel (Admin only) -->
    <transition name="fade">
      <div v-if="showDeviceDrawer" class="drawer-backdrop" @click.self="closeDeviceAssignDrawer">
        <aside class="drawer-panel">
          <header class="drawer-header">
            <div class="drawer-title-group">
              <h3>Assign Kapal Device</h3>
              <p class="drawer-subtitle" v-if="drawerAdminName">{{ drawerAdminName }}</p>
            </div>
            <button type="button" class="drawer-close" @click="closeDeviceAssignDrawer">&times;</button>
          </header>
          <div class="drawer-section">
            <div class="drawer-alert error" v-if="deviceAssignError">{{ deviceAssignError }}</div>
            <div class="drawer-alert success" v-if="deviceAssignSuccess">{{ deviceAssignSuccess }}</div>
          </div>
          <div class="drawer-section drawer-controls">
            <div class="drawer-search">
              <input type="text" v-model.trim="deviceSearch" placeholder="Cari device SN atau nama kapal" :disabled="deviceLoading" />
              <button type="button" class="drawer-icon-btn" :disabled="deviceLoading" title="Refresh daftar device" @click="fetchDevices(true)">&#8635;</button>
            </div>
            <span class="drawer-count" v-if="!deviceLoading">{{ filteredDevices.length }} device</span>
          </div>
          <div class="drawer-body assign-device-body">
            <div v-if="deviceLoading" class="drawer-placeholder">Memuat daftar device...</div>
            <template v-else>
              <div class="assign-columns">
                <!-- Unassigned Devices -->
                <div class="assign-column">
                  <h4>Device (Unassigned)</h4>
                  <div v-if="deviceError" class="drawer-placeholder error">{{ deviceError }}</div>
                  <div v-else-if="filteredDevices.length===0" class="drawer-placeholder">Tidak ada device tersedia.</div>
                  <ul v-else class="assign-list">
                    <li v-for="dev in filteredDevices" :key="dev.sn" :class="['assign-item', { selected: selectedDevice && selectedDevice.sn===dev.sn }]" @click="selectDevice(dev)">
                      <div class="assign-item-block">
                        <div class="assign-title">{{ dev.name || 'Tanpa Nama' }}</div>
                        <div class="assign-sub">SN: {{ dev.sn }}</div>
                      </div>
                    </li>
                  </ul>
                </div>
                <!-- Vessels With ID -->
                <div class="assign-column">
                  <h4>Vessel (Memiliki ID)</h4>
                  <div v-if="vesselLoading" class="drawer-placeholder">Memuat kapal...</div>
                  <div v-else-if="vesselList.length===0" class="drawer-placeholder">Tidak ada kapal.</div>
                  <ul v-else class="assign-list">
                    <li v-for="v in vesselsWithId" :key="v.vessel_id || ('sn:'+v.sn)" :class="['assign-item', { selected: selectedVessel && (selectedVessel.vessel_id===v.vessel_id) }]" @click="onSelectVessel(v)">
                      <div class="assign-item-block">
                        <div class="assign-title">SN: {{ v.sn }}</div>
                        <div class="assign-sub">ID: {{ v.vessel_id }}</div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </div>
          <footer class="drawer-footer">
            <div class="drawer-selected">
              <strong>{{ selectedDevice ? 1 : 0 }}</strong><span>device</span>
              <strong>{{ selectedVessel ? 1 : 0 }}</strong><span>vessel</span>
            </div>
            <div class="drawer-actions">
              <button type="button" class="secondary-button" @click="closeDeviceAssignDrawer" :disabled="deviceAssignSubmitting">Batal</button>
              <button type="button" class="primary-button" @click="submitDeviceAssignment" :disabled="deviceAssignSubmitting || !selectedDevice || !selectedVessel">
                <span v-if="deviceAssignSubmitting" class="spinner"></span>
                <span>{{ deviceAssignSubmitting ? 'Mengirim...' : 'Kirim' }}</span>
              </button>
            </div>
          </footer>
        </aside>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import DotsIcon from '../assets/vertical-dots.svg'

const props = defineProps({
  currentUser: {
    type: Object,
    default: null,
  },
  totalShips: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['user-created'])

const API_HOST = 'https://bcknd.fly.dev'
const LIST_USERS_URL = `${API_HOST}/api/v1/auth/admin/list-users`
const SIGN_UP_ENDPOINTS = [
  `${API_HOST}/auth/sign-up/email`,
  `${API_HOST}/api/v1/auth/sign-up/email`,
]
const UPDATE_USER_ENDPOINTS = [
  `${API_HOST}/auth/admin/update-user`,
  `${API_HOST.replace('https','http')}/auth/admin/update-user`,
  `${API_HOST}/api/v1/auth/admin/update-user`,
]
const VESSEL_LIST_URL = `${API_HOST}/api/v1/vessel`
const VESSEL_REGISTER_URL = `${API_HOST}/api/v1/vessel/register`
const DEVICE_LIST_URL = `${API_HOST}/api/v1/device`
const DEVICE_ASSIGN_URL = `${API_HOST}/api/v1/vessel/device/register`

const getJakartaDateString = (offsetDays = 0) => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  let year = 0
  let month = 0
  let day = 0
  parts.forEach(({ type, value }) => {
    if (type === 'year') year = Number(value)
    if (type === 'month') month = Number(value)
    if (type === 'day') day = Number(value)
  })
  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10)
  }
  const base = new Date(Date.UTC(year, month - 1, day))
  if (offsetDays) {
    base.setUTCDate(base.getUTCDate() + offsetDays)
  }
  const pad = (value) => value.toString().padStart(2, '0')
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`
}

const users = ref([])
const isLoading = ref(false)
const globalError = ref('')
const globalSuccess = ref('')

const searchTerm = ref('')
const roleFilter = ref('')
const rowsPerPage = ref(10)
const rowOptions = [10, 25, 50]
const currentPage = ref(1)

const showCreateModal = ref(false)
const formSubmitting = ref(false)
const formError = ref('')
const formSuccess = ref('')

const showEditModal = ref(false)
const editSubmitting = ref(false)
const editError = ref('')
const editSuccess = ref('')
const editForm = reactive({ id: '', email: '', name: '', role: 'user' })

const showVesselDrawer = ref(false)
const vesselTargetUser = ref(null)
const vesselList = ref([])
const vesselLoading = ref(false)
const vesselError = ref('')
const vesselAssignError = ref('')
const vesselAssignSuccess = ref('')
const vesselAssignSubmitting = ref(false)
const vesselSearch = ref('')
const vesselSelectedSNs = ref([])
const vesselAssignmentsCache = reactive({})
// Cache hasil cek label per user dari database: user_id -> [SN]
const userAssignedVesselSNs = reactive({})

// Device assignment (admin)
const showDeviceDrawer = ref(false)
const deviceLoading = ref(false)
const deviceError = ref('')
const deviceAssignError = ref('')
const deviceAssignSuccess = ref('')
const deviceAssignSubmitting = ref(false)
const deviceList = ref([])
const deviceSearch = ref('')
const selectedDevice = ref(null)
const selectedVessel = ref(null)
const drawerAdminName = computed(() => editForm?.name || editForm?.email || '')

const setUserAssignedSNs = (userId, list) => {
  if (!userId) return
  const normalized = Array.from(new Set((list || []).map((item) => item.toString().trim()).filter(Boolean)))
  userAssignedVesselSNs[userId] = normalized
}

const getUserAssignedSNs = (userId) => {
  if (!userId) return []
  const val = userAssignedVesselSNs[userId]
  if (!Array.isArray(val)) return []
  return val.map((v) => v.toString().trim()).filter(Boolean)
}

// Normalisasi SN: rapikan spasi, hilangkan prefix lawas seperti '0-', dan ambil digit utama
const normalizeSerial = (value) => {
  if (value === null || value === undefined) return ''
  let raw = value.toString().trim()
  // Hilangkan semua spasi internal (jika format aneh) tanpa mengubah urutan digit
  raw = raw.replace(/\s+/g, '')
  // Jika memiliki prefix '0-' diikuti digit, buang prefix
  if (/^0-\d+$/.test(raw)) {
    raw = raw.slice(2)
  }
  const digits = raw.replace(/\D+/g, '')
  return digits || raw
}

// Helper: dapatkan key cache alternatif (id + email) tanpa mengubah fungsi fetch
const getCacheKeys = (record) => {
  if (!record || typeof record !== 'object') return []
  const keys = []
  const id = record.id || record.user_id || record.userId
  const email = record.email
  if (id) keys.push(id.toString().trim())
  if (email) keys.push(email.toString().trim())
  return Array.from(new Set(keys.filter(Boolean)))
}

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: 'user',
})

const filteredUsers = computed(() => {
  const term = searchTerm.value.toLowerCase()
  return users.value.filter((item) => {
    const matchesTerm = term
      ? (item.name || item.full_name || item.fullName || '').toLowerCase().includes(term) || (item.email || '').toLowerCase().includes(term)
      : true
    const role = (item.role || '').toString().toLowerCase().replace(/\s+/g, '_')
    const matchesRole = roleFilter.value ? role === roleFilter.value : true
    return matchesTerm && matchesRole
  })
})

const totalPages = computed(() => {
  if (filteredUsers.value.length === 0) {
    return 1
  }
  return Math.max(1, Math.ceil(filteredUsers.value.length / rowsPerPage.value))
})

const pagedUsers = computed(() => {
  const start = (currentPage.value - 1) * rowsPerPage.value
  const end = start + rowsPerPage.value
  return filteredUsers.value.slice(start, end)
})

const shipsCountLabel = computed(() => {
  const count = Number.isFinite(props.totalShips) ? props.totalShips : 0
  return `${count} Kapal`
})

const filteredVessels = computed(() => {
  const term = vesselSearch.value.trim().toLowerCase()
  // Bangun dua set: bentuk asli & bentuk normalisasi agar pencocokan komprehensif
  const selectedRaw = new Set()
  const selectedNormalized = new Set()
  vesselSelectedSNs.value.forEach((value) => {
    const raw = (value || '').toString().trim()
    if (raw) selectedRaw.add(raw)
    const norm = normalizeSerial(raw)
    if (norm) selectedNormalized.add(norm)
  })
  const available = vesselList.value.filter((ship) => {
    const raw = (ship.sn || '').toString().trim()
    if (!raw) return false
    const norm = normalizeSerial(raw)
    // Exclude jika salah satu bentuk sudah dipilih
    if (selectedRaw.has(raw) || selectedNormalized.has(norm)) return false
    return true
  })
  if (!term) return available
  return available.filter((ship) => {
    const name = (ship.name || '').toString().toLowerCase()
    const snRaw = (ship.sn || '').toString().trim().toLowerCase()
    const snNorm = normalizeSerial(ship.sn || '').toLowerCase()
    return name.includes(term) || snRaw.includes(term) || snNorm.includes(term)
  })
})

// Show all vessels returned by the API (no filtering/hiding)
const vesselsWithId = computed(() => vesselList.value)

// Filter devices (unassigned or all) by search; show devices lacking vessel_id first
const filteredDevices = computed(() => {
  const term = deviceSearch.value.trim().toLowerCase()
  // Only devices without vessel_id
  const base = deviceList.value.filter(d => !d.vessel_id).slice().sort((a,b)=>{
    return (a.sn||'').localeCompare(b.sn||'', 'id', { sensitivity:'base' })
  })
  if (!term) return base
  return base.filter(d => (d.sn||'').toLowerCase().includes(term) || (d.name||'').toLowerCase().includes(term))
})

// Jumlah kapal dari label database untuk user tertentu (dipakai di tabel)
const labelShipCountForUser = (userRecord) => {
  if (!userRecord) return '-'
  const role = normalizeRoleValue(userRecord.role)
  if (role !== 'user') return shipCountFor(userRecord)
  const id = userRecord.id || userRecord.user_id || userRecord.userId
  if (!id) return shipCountFor(userRecord)
  const list = getUserAssignedSNs(id)
  if (Array.isArray(list)) return list.length
  return shipCountFor(userRecord)
}

const drawerUserName = computed(() => {
  const user = vesselTargetUser.value
  if (!user) return ''
  return user.name || user.full_name || user.fullName || user.email || ''
})

const selectedVesselDetails = computed(() => {
  return vesselSelectedSNs.value.map((sn) => {
    const serial = (sn || '').toString().trim()
    const norm = normalizeSerial(serial)
    // Cari match baik raw maupun normalized
    const match = vesselList.value.find((item) => {
      const itemRaw = (item.sn || '').toString().trim()
      const itemNorm = normalizeSerial(itemRaw)
      return itemRaw === serial || itemNorm === norm
    })
    return {
      sn: serial,
      name: match?.name || `SN ${serial}`,
    }
  })
})

// Helper to safely extract numeric fields
const getNumeric = (val) => {
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

// Resolve per-user ship count from record fields or override with current account data
const shipCountFor = (userRecord) => {
  if (!userRecord) return '-'
  // If this row corresponds to the currently logged-in user, use live total from Home sidebar
  const sameUser = (props.currentUser?.id && userRecord.id && props.currentUser.id === userRecord.id)
    || (props.currentUser?.email && userRecord.email && props.currentUser.email === userRecord.email)
  if (sameUser && Number.isFinite(props.totalShips)) {
    return props.totalShips
  }

  // Common numeric fields seen in APIs
  const numericCandidates = [
    userRecord.ship_count,
    userRecord.ships_count,
    userRecord.total_ships,
    userRecord.total_ship,
    userRecord.vessel_count,
    userRecord.vessels_count,
    userRecord.total_vessels,
    userRecord.kapal_count,
    userRecord.jumlah_kapal,
  ]
  for (const cand of numericCandidates) {
    const n = getNumeric(cand)
    if (n !== null) return n
  }

  // Array-based candidates
  const arrayCandidates = [
    userRecord.vessels,
    userRecord.ships,
    userRecord.assignedVessels,
    userRecord.assigned_ships,
    userRecord.accessibleVessels,
    userRecord.accessible_ships,
  ]
  for (const arr of arrayCandidates) {
    if (Array.isArray(arr)) return arr.length
  }

  return '-'
}

const normalizeRoleValue = (value) => (value || '').toString().toLowerCase().replace(/\s+/g, '_')

const isManageableUser = (role) => normalizeRoleValue(role) === 'user'

const extractSerialsFromRecord = (record) => {
  const result = new Set()
  if (!record || typeof record !== 'object') return []

  const addSerial = (value) => {
    if (value === null || value === undefined) return
    const str = value.toString().trim()
    if (str) result.add(str)
  }

  const arrayCandidates = [
    record.vessels,
    record.assignedVessels,
    record.assigned_ships,
    record.accessibleVessels,
    record.accessible_ships,
    record.ships,
  ]

  for (const candidate of arrayCandidates) {
    if (!Array.isArray(candidate)) continue
    for (const item of candidate) {
      if (typeof item === 'string' || typeof item === 'number') {
        addSerial(item)
        continue
      }
      if (item && typeof item === 'object') {
        const serialKeys = ['sn', 'serial_number', 'serialNumber', 'vessel_sn', 'ship_sn', 'serial']
        for (const key of serialKeys) {
          if (key in item) {
            addSerial(item[key])
            break
          }
        }
      }
    }
  }

  const singleValueCandidates = [
    record.vessel_sn,
    record.serial_number,
    record.serialNumber,
    record.sn,
    record.primary_vessel_sn,
  ]
  singleValueCandidates.forEach(addSerial)

  return Array.from(result).map((item) => item.toString().trim()).filter(Boolean)
}

const getCachedAssignments = (userId) => {
  if (!userId) return []
  const cached = vesselAssignmentsCache[userId]
  if (!Array.isArray(cached)) return []
  return cached.map((item) => item.toString().trim()).filter(Boolean)
}

const setCachedAssignments = (userId, list) => {
  if (!userId) return
  const normalized = Array.from(new Set((list || []).map((item) => item.toString().trim()).filter(Boolean)))
  vesselAssignmentsCache[userId] = normalized
}

const isValidVesselId = (val) => typeof val === 'string' && val.trim().length === 32

const normalizeShipRecord = (ship, index) => {
  const rawSn = ship.sn || ship.serial_number || ship.serialNumber || ship.id || `SN${index + 1}`
  const vesselIdRaw = ship.vessel_id || ship.id || ''
  const vesselId = isValidVesselId(vesselIdRaw) ? vesselIdRaw.trim() : null
  return {
    // Only set `id` if there is a valid vessel_id; otherwise leave null
    id: vesselId || null,
    vessel_id: vesselId, // canonical validated vessel id or null
    sn: rawSn !== undefined && rawSn !== null ? rawSn.toString().trim() : '',
    name: ship.name || ship.nama_kapal || ship.vessel_name || ship.ship_name || `Kapal ${index + 1}`,
    lat: parseFloat(ship.lat ?? ship.latitude ?? ship.latitud ?? 0),
    lng: parseFloat(ship.lng ?? ship.longitude ?? ship.longitud ?? ship.lon ?? 0),
  }
}

// Normalize device records from /device endpoint
const normalizeDeviceRecord = (dev, index) => {
  const rawSn = dev.sn || dev.serial_number || dev.serialNumber || dev.device_sn || `device_${index+1}`
  return {
    sn: rawSn ? rawSn.toString().trim() : '',
    vessel_id: dev.vessel_id || dev.vesselId || null,
    name: dev.name || dev.device_name || dev.label || '',
    api_keys: dev.api_keys || dev.apiKeys || null,
    id: dev.id || dev.device_id || null,
  }
}

const fetchDevices = async (force=false) => {
  if (!force && deviceList.value.length>0) return
  deviceLoading.value = true
  deviceError.value = ''
  try {
    const response = await fetch(DEVICE_LIST_URL, {
      method:'GET',
      headers:{ 'Accept':'application/json','Content-Type':'application/json' },
      credentials:'include'
    })
    if (!response.ok) throw new Error(`Gagal memuat daftar device (${response.status})`)
    const json = await response.json().catch(()=>({}))
    let payload = []
    if (Array.isArray(json)) payload = json
    else if (Array.isArray(json?.data)) payload = json.data
    else if (Array.isArray(json?.devices)) payload = json.devices
    deviceList.value = payload.map((d,i)=>normalizeDeviceRecord(d,i)).filter(d=>d.sn)
  } catch (e) {
    console.error('Fetch devices error:', e)
    deviceError.value = e.message || 'Terjadi kesalahan saat memuat device.'
    deviceList.value = []
  } finally {
    deviceLoading.value = false
  }
}

const openDeviceAssignDrawer = async (record) => {
  if (!record) return
  deviceAssignError.value = ''
  deviceAssignSuccess.value = ''
  deviceSearch.value = ''
  selectedDevice.value = null
  selectedVessel.value = null
  showDeviceDrawer.value = true
  await fetchDevices(true)
  await fetchVessels(false)
}

const closeDeviceAssignDrawer = () => {
  showDeviceDrawer.value = false
  deviceAssignError.value = ''
  deviceAssignSuccess.value = ''
  deviceSearch.value = ''
  selectedDevice.value = null
  selectedVessel.value = null
}

const selectDevice = (dev) => {
  if (!dev) return
  // Hanya pilih device tanpa vessel_id
  if (dev.vessel_id) return
  selectedDevice.value = dev
}

// Only vessels with valid 32-char vessel_id are selectable in the right column.
const canSelectVessel = (v) => !!v && !!v.vessel_id && isValidVesselId(v.vessel_id)

const onSelectVessel = (v) => {
  if (!canSelectVessel(v)) return
  selectedVessel.value = v
}

const submitDeviceAssignment = async () => {
  deviceAssignError.value = ''
  deviceAssignSuccess.value = ''
  if (!selectedDevice.value || !selectedVessel.value) {
    deviceAssignError.value = 'Pilih device dan vessel terlebih dahulu.'
    return
  }
  deviceAssignSubmitting.value = true
  try {
    if (!selectedVessel.value?.vessel_id || !isValidVesselId(selectedVessel.value.vessel_id)) {
      throw new Error('Pilih vessel dengan vessel_id valid (32 karakter).')
    }
    const payload = { device_sn: selectedDevice.value.sn, vessel_id: selectedVessel.value.vessel_id }
    const response = await fetch(VESSEL_REGISTER_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json','Accept':'application/json' },
      credentials:'include',
      body: JSON.stringify(payload)
    })
    const json = await response.json().catch(()=>({}))
    if (!response.ok || json?.error) {
      const msg = json?.message || json?.error?.message || `Gagal assign (${response.status})`
      throw new Error(msg)
    }
    deviceAssignSuccess.value = 'Device berhasil diassign ke vessel.'
    await fetchDevices(true)
    selectedDevice.value = null
    selectedVessel.value = null
    setTimeout(()=>{ if (showDeviceDrawer.value) closeDeviceAssignDrawer() }, 900)
  } catch (e) {
    console.error('Assign device error:', e)
    deviceAssignError.value = e.message || 'Gagal mengirim assignment.'
  } finally {
    deviceAssignSubmitting.value = false
  }
}

const fetchVessels = async (force = false) => {
  if (!force && vesselList.value.length > 0) return
  vesselLoading.value = true
  vesselError.value = ''
  try {
  const url = new URL(VESSEL_LIST_URL)
  //url.searchParams.set('active_date', getJakartaDateString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Gagal memuat daftar kapal (${response.status})`)
    }

    const json = await response.json().catch(() => ([]))
    let payload = []
    if (Array.isArray(json)) {
      payload = json
    } else if (Array.isArray(json?.data)) {
      payload = json.data
    } else if (Array.isArray(json?.ships)) {
      payload = json.ships
    } else if (Array.isArray(json?.vessels)) {
      payload = json.vessels
    }

    vesselList.value = payload
      .map((ship, index) => normalizeShipRecord(ship, index))
      .filter((ship) => ship.sn)
      .sort((a, b) => a.name.toString().localeCompare(b.name.toString(), 'id', { sensitivity: 'base' }))
  } catch (error) {
    console.error('Fetch vessels error:', error)
    vesselError.value = error.message || 'Terjadi kesalahan saat memuat daftar kapal.'
    vesselList.value = []
  } finally {
    vesselLoading.value = false
  }
}

// Ambil daftar kapal yang berlabel untuk user tertentu (cek database)
const fetchUserVesselsFor = async (userId) => {
  if (!userId) return []
  try {
    const url = new URL(VESSEL_LIST_URL)
    url.searchParams.set('user_id', userId)
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Gagal memuat kapal untuk user (${response.status})`)
    }
    const json = await response.json().catch(() => ([]))
    let payload = []
    if (Array.isArray(json)) payload = json
    else if (Array.isArray(json?.data)) payload = json.data
    else if (Array.isArray(json?.ships)) payload = json.ships
    else if (Array.isArray(json?.vessels)) payload = json.vessels

    const normalized = payload
      .map((ship, index) => normalizeShipRecord(ship, index))
      .filter((ship) => ship.sn)

    const sns = normalized.map((s) => (s.sn || '').toString().trim()).filter(Boolean)
    setUserAssignedSNs(userId, sns)
    return sns
  } catch (err) {
    console.error('Fetch user vessels error:', err)
    // Jangan gagal total: kembalikan cache jika ada, atau []
    return getUserAssignedSNs(userId)
  }
}

const openVesselDrawer = async (record) => {
  if (!record) return
  vesselAssignError.value = ''
  vesselAssignSuccess.value = ''
  vesselSearch.value = ''
  vesselTargetUser.value = record
  let initialAssignments = extractSerialsFromRecord(record)
  if (initialAssignments.length === 0) {
    // Coba semua key cache alternatif (id + email)
    const cacheKeys = getCacheKeys(record)
    for (const key of cacheKeys) {
      const cached = getCachedAssignments(key)
      if (cached.length > 0) {
        initialAssignments = cached
        break
      }
    }
  }
  // Selalu cek label dari database untuk memastikan state teranyar
  try {
    const labeled = await fetchUserVesselsFor(record.id)
    if (Array.isArray(labeled) && labeled.length > 0) {
      initialAssignments = labeled
    }
  } catch (_) {}
  vesselSelectedSNs.value = initialAssignments.slice()
  showVesselDrawer.value = true
  await fetchVessels(false)
}

const closeVesselDrawer = () => {
  showVesselDrawer.value = false
  vesselTargetUser.value = null
  vesselSearch.value = ''
  vesselAssignError.value = ''
  vesselAssignSuccess.value = ''
  vesselAssignSubmitting.value = false
  vesselSelectedSNs.value = []
  vesselError.value = ''
}

const isShipSelected = (sn) => {
  const value = (sn || '').toString().trim()
  return vesselSelectedSNs.value.includes(value)
}

const toggleShipSelection = (sn, checked) => {
  const value = (sn || '').toString().trim()
  if (!value) return
  const current = new Set(vesselSelectedSNs.value)
  if (checked) {
    current.add(value)
  } else {
    current.delete(value)
  }
  vesselSelectedSNs.value = Array.from(current)
}

const submitVesselAssignments = async () => {
  vesselAssignError.value = ''
  vesselAssignSuccess.value = ''
  const user = vesselTargetUser.value
  if (!user?.id) {
    vesselAssignError.value = 'Tidak bisa menentukan akun pengguna.'
    return
  }
  vesselAssignSubmitting.value = true
  try {
    // Ambil daftar SN yang dipilih (tanpa memaksakan format tertentu)
    const selectedSNs = vesselSelectedSNs.value
      .map((raw) => (raw || '').toString().trim())
      .filter(Boolean)

    if (selectedSNs.length === 0) {
      vesselAssignError.value = 'Tidak ada kapal yang dipilih.'
      vesselAssignSubmitting.value = false
      return
    }

    // Peta SN -> vessel.id agar payload umum dan tidak tergantung pola SN tertentu
    const lookup = new Map()
    vesselList.value.forEach((ship) => {
      const rawSn = (ship.sn || '').toString().trim()
      if (rawSn) lookup.set(rawSn, ship.vessel_id)
    })

    const vesselIds = selectedSNs.map((sn) => lookup.get(sn)).filter((id)=>isValidVesselId(id))
    const unmatched = selectedSNs.filter((sn) => !lookup.has(sn))

    if (vesselIds.length === 0) {
      vesselAssignError.value = 'ID kapal tidak ditemukan untuk pilihan yang diberikan.'
      vesselAssignSubmitting.value = false
      return
    }
    if (unmatched.length > 0) {
      vesselAssignError.value = `Sebagian SN tidak ditemukan: ${unmatched.join(', ')}`
      vesselAssignSubmitting.value = false
      return
    }

    // Payload baru sesuai spesifikasi: { account_id, vessels: [vessel_id...] }
    const payload = {
      account_id: user.id,
      vessels: vesselIds,
    }

    const response = await fetch(VESSEL_REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    const json = await response.json().catch(() => ({}))
    if (!response.ok || json?.error) {
      const message = json?.message || json?.error?.message || `Permintaan gagal (${response.status})`
      throw new Error(message)
    }

    vesselAssignSuccess.value = 'Akses kapal berhasil diperbarui.'
    globalSuccess.value = 'Daftar kapal pengguna berhasil diperbarui.'
    // Cache tetap menggunakan SN agar tampilan konsisten dengan fungsi existing
    setCachedAssignments(user.id, selectedSNs)
    // Refresh label-based assignments & edit count
    await fetchUserVesselsFor(user.id)
    await fetchUsers()
    setTimeout(() => {
      if (showVesselDrawer.value) {
        closeVesselDrawer()
      }
    }, 800)
  } catch (error) {
    console.error('Assign vessels error:', error)
    vesselAssignError.value = error.message || 'Gagal menyimpan akses kapal.'
  } finally {
    vesselAssignSubmitting.value = false
  }
}

watch([searchTerm, roleFilter, rowsPerPage], () => {
  currentPage.value = 1
})

watch(filteredUsers, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

const resetForm = () => {
  form.name = ''
  form.email = ''
  form.password = ''
  form.role = 'user'
  formError.value = ''
  formSuccess.value = ''
}

const openCreateModal = () => {
  resetForm()
  showCreateModal.value = true
}

const closeCreateModal = () => {
  showCreateModal.value = false
  resetForm()
}

const openEditModal = (record) => {
  editError.value = ''
  editSuccess.value = ''
  editForm.id = record?.id || ''
  editForm.email = record?.email || ''
  editForm.name = record?.name || record?.full_name || record?.fullName || ''
  editForm.role = (record?.role || 'user').toString().toLowerCase().replace(/\s+/g, '_')
  showEditModal.value = true
  // Preload jumlah kapal dari label database untuk user yang diedit
  if (isManageableUser(editForm.role) && editForm.id) {
    fetchUserVesselsFor(editForm.id)
  }
}

const closeEditModal = () => {
  showEditModal.value = false
}

const parseUsersPayload = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.users)) return payload.users
  if (payload.data && Array.isArray(payload.data.users)) return payload.data.users
  if (payload.data && Array.isArray(payload.data.items)) return payload.data.items
  if (payload.result && Array.isArray(payload.result)) return payload.result
  if (payload.data && payload.data.list && Array.isArray(payload.data.list)) return payload.data.list
  return []
}

const fetchUsers = async () => {
  isLoading.value = true
  globalError.value = ''
  try {
    const params = new URLSearchParams()
    params.set('limit', '200')
    params.set('offset', '0')

    const url = `${LIST_USERS_URL}?${params.toString()}`
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Gagal mengambil data pengguna (${response.status})`)
    }

    const json = await response.json().catch(() => ({}))
    const fetched = parseUsersPayload(json) || []

    users.value = fetched
      .slice()
      .sort((a, b) => {
        const aKey = (a.email || a.name || '').toString().toLowerCase()
        const bKey = (b.email || b.name || '').toString().toLowerCase()
        return aKey.localeCompare(bKey, 'id', { sensitivity: 'base' })
      })

    users.value.forEach((userRecord) => {
      const serials = extractSerialsFromRecord(userRecord)
      if (serials.length > 0) {
        setCachedAssignments(userRecord.id, serials)
      }
    })

    // Prefetch label-based vessel lists for role user agar jumlah kapal di tabel akurat
    const toPrefetch = users.value
      .filter((u) => normalizeRoleValue(u.role) === 'user' && (u.id || u.user_id || u.userId))
      .map((u) => u.id || u.user_id || u.userId)
    // Prefetch sequentially to avoid hammering the API
    for (const uid of toPrefetch) {
      // ignore errors; cache function already handles fallbacks
      // eslint-disable-next-line no-await-in-loop
      await fetchUserVesselsFor(uid)
    }
  } catch (error) {
    console.error('Fetch users error:', error)
    globalError.value = error.message || 'Terjadi kesalahan saat mengambil data pengguna.'
  } finally {
    isLoading.value = false
  }
}

const postSignUp = async (payload) => {
  const body = JSON.stringify(payload)
  let lastError = null
  for (const endpoint of SIGN_UP_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body,
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || (json && json.error)) {
        const message = json?.error?.message || json?.message || `Permintaan gagal (${response.status})`
        throw new Error(message)
      }
      return json
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Gagal membuat pengguna')
}

const handleCreateUser = async () => {
  formError.value = ''
  formSuccess.value = ''
  globalSuccess.value = ''
  if (!form.name || !form.email || !form.password) {
    formError.value = 'Semua field wajib diisi.'
    return
  }
  if (form.password.length < 6) {
    formError.value = 'Password minimal 6 karakter.'
    return
  }

  formSubmitting.value = true
  try {
    const payload = {
      email: form.email,
      password: form.password,
      name: form.name,
      metadata: {
        role: form.role,
        created_by: props.currentUser?.id || props.currentUser?.email || 'admin',
      },
      role: form.role,
    }
    const result = await postSignUp(payload)
    formSuccess.value = 'Akun berhasil dibuat.'
    globalSuccess.value = 'Akun baru berhasil ditambahkan dan siap digunakan.'
    emit('user-created', result?.data || null)
    await fetchUsers()
    setTimeout(() => {
      if (showCreateModal.value) {
        closeCreateModal()
      }
    }, 600)
  } catch (error) {
    console.error('Sign-up error:', error)
    formError.value = error.message || 'Gagal membuat akun baru.'
  } finally {
    formSubmitting.value = false
  }
}

const postUpdateUser = async (payload) => {
  const body = JSON.stringify(payload)
  let lastError = null
  for (const endpoint of UPDATE_USER_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body,
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || (json && json.error)) {
        const message = json?.error?.message || json?.message || `Permintaan gagal (${response.status})`
        throw new Error(message)
      }
      return json
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Gagal memperbarui pengguna')
}

const handleUpdateUser = async () => {
  editError.value = ''
  editSuccess.value = ''
  if (!editForm.id) {
    editError.value = 'ID pengguna tidak ditemukan.'
    return
  }
  if (!editForm.email || !editForm.name) {
    editError.value = 'Name dan email wajib diisi.'
    return
  }
  editSubmitting.value = true
  try {
    const dataPayload = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
    }
    // Remove undefined/empty values so backend receives only changed keys
    Object.keys(dataPayload).forEach((key) => {
      if (dataPayload[key] === undefined || dataPayload[key] === '') {
        delete dataPayload[key]
      }
    })

    const payload = {
      userId: editForm.id,
      data: dataPayload,
    }
    await postUpdateUser(payload)
    editSuccess.value = 'Perubahan tersimpan.'
    await fetchUsers()
    setTimeout(() => { if (showEditModal.value) closeEditModal() }, 600)
  } catch (error) {
    console.error('Update user error:', error)
    editError.value = error.message || 'Gagal memperbarui data pengguna.'
  } finally {
    editSubmitting.value = false
  }
}

const formatRole = (value) => {
  const normalized = (value || '').toString().trim()
  if (!normalized) return 'User'
  return normalized
    .replace(/[_\s]+/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const roleBadgeClass = (value) => {
  const normalized = (value || '').toString().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'admin') return 'role-admin'
  if (normalized === 'super_admin' || normalized === 'superadmin') return 'role-super'
  return 'role-user'
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value -= 1
  }
}

const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value += 1
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.admin-users-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #0f172a;
}

.users-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-block {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.title-label {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.status-badge.beta {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.25);
  color: #1d4ed8;
}

.header-description {
  font-size: 0.92rem;
  color: #475569;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.primary-button,
.refresh-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 600;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-button {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.25);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-button {
  background: #f1f5f9;
  color: #1e293b;
}

.refresh-button:hover:not(:disabled) {
  background: #e2e8f0;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button {
  background: #e2e8f0;
  color: #0f172a;
}

.secondary-button:hover {
  background: #cbd5f5;
}

.filters-card {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 16px;
  background: #ffffff;
  border-radius: 20px;
  padding: 20px 24px;
  box-shadow: 0 10px 30px rgba(148, 163, 184, 0.15);
}

.filter-input,
.filter-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 0 14px;
}

.input-with-icon input {
  flex: 1;
  height: 42px;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: #0f172a;
  outline: none;
  padding-left: 10px;
}

.filter-select select,
.form-field select,
.form-field input,
.input-with-icon input {
  font-family: 'Inter', Arial, sans-serif;
}

.filter-select select {
  height: 42px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 0 12px;
  background: #f8fafc;
  color: #0f172a;
}

.users-table-card {
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 16px 32px rgba(148, 163, 184, 0.15);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.table-wrapper {
  overflow-x: auto;
}

.table-wrapper table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 800px;
}

.table-wrapper th {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: #475569;
  background: #f8fafc;
  padding: 12px 16px;
  text-align: left;
}

.table-wrapper td {
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.95rem;
  color: #0f172a;
}

.actions-cell {
  text-align: right;
}

.menu-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.menu-btn:hover {
  background: #eef2f7;
}

.text-left {
  text-align: left;
}

.table-placeholder {
  text-align: center;
  padding: 32px 16px;
  color: #64748b;
  font-style: italic;
}

.primary-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cell-text {
  display: inline-block;
  color: #0f172a;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.role-admin {
  background: rgba(59, 130, 246, 0.15);
  color: #1d4ed8;
}

.role-super {
  background: rgba(147, 51, 234, 0.18);
  color: #7c3aed;
}

.role-user {
  background: rgba(16, 185, 129, 0.15);
  color: #047857;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.rows-control,
.pagination {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.rows-control select {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
}

.pagination button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #0f172a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination button:hover:not(:disabled) {
  background: #e2e8f0;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.global-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 0.9rem;
  border: 1px solid transparent;
}

.global-alert.error {
  background: #fee2e2;
  border-color: #fecaca;
  color: #b91c1c;
}

.global-alert.success {
  background: #dcfce7;
  border-color: #bbf7d0;
  color: #047857;
}

.alert-close {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: inherit;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1000;
}

.modal-card {
  background: #ffffff;
  border-radius: 24px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #0f172a;
}

.modal-header p {
  margin: 6px 0 0;
  color: #475569;
  font-size: 0.9rem;
}

.modal-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  color: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.modal-form {
  padding: 24px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.form-field input,
.form-field select {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  font-size: 0.95rem;
  color: #0f172a;
  background: #ffffff;
}

.modal-alert {
  border-radius: 12px;
  padding: 12px;
  font-size: 0.85rem;
}

.modal-alert.error {
  background: #fee2e2;
  color: #b91c1c;
}

.modal-alert.success {
  background: #dcfce7;
  color: #047857;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.ship-manage-cell {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}

.assign-button {
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: #e2e8f0;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.assign-button:hover {
  background: #cbd5f5;
  transform: translateY(-1px);
}

/* Assign Device Drawer */
.assign-device-body { display:flex; flex-direction:column; }
.assign-columns { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
.assign-column h4 { margin:0 0 8px; font-size:0.9rem; font-weight:600; color:#0f172a; }
.assign-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.assign-item { border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; cursor:pointer; background:#ffffff; transition:.2s box-shadow,.2s border-color; }
.assign-item:hover { border-color:#cbd5f5; box-shadow:0 8px 16px rgba(148,163,184,0.18); }
.assign-item.selected { border-color:#2563eb; box-shadow:0 0 0 2px rgba(37,99,235,0.35); }
.assign-item.disabled { opacity:.55; cursor:not-allowed; }
.assign-item-block { display:flex; flex-direction:column; gap:4px; }
.assign-title { font-weight:700; font-size:0.9rem; color:#0f172a; }
.assign-sub { font-size:0.75rem; color:#475569; }
.assign-hint { font-size:0.65rem; color:#b91c1c; letter-spacing:.5px; text-transform:uppercase; }

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: flex-end;
  z-index: 1200;
}

.drawer-panel {
  width: min(420px, 100%);
  background: #ffffff;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow: -12px 0 32px rgba(15, 23, 42, 0.18);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.drawer-title-group h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}

.drawer-subtitle {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #475569;
}

.drawer-close {
  border: none;
  background: transparent;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  color: #94a3b8;
  transition: color 0.2s ease;
}

.drawer-close:hover {
  color: #1e293b;
}

.drawer-section {
  padding: 16px 24px;
}

.drawer-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.drawer-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border-radius: 12px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
}

.drawer-search input {
  flex: 1;
  border: none;
  background: transparent;
  height: 40px;
  font-size: 0.9rem;
  color: #0f172a;
  outline: none;
}

.drawer-icon-btn {
  border: none;
  background: transparent;
  font-size: 1rem;
  cursor: pointer;
  color: #1d4ed8;
}

.drawer-icon-btn:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.drawer-count {
  font-size: 0.85rem;
  color: #475569;
}

.drawer-body {
  flex: 1;
  padding: 0 24px 24px;
  overflow-y: auto;
}

.drawer-selected-list {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 18px;
}

.drawer-selected-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #1e293b;
}

.drawer-selected-header h4,
.drawer-available-block h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.drawer-selected-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drawer-selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.drawer-selected-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-selected-name {
  font-weight: 600;
  color: #0f172a;
}

.drawer-selected-sn {
  font-size: 0.8rem;
  color: #475569;
}

.drawer-remove-btn {
  border: none;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.drawer-remove-btn:hover:not(:disabled) {
  background: #fecaca;
}

.drawer-remove-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.drawer-available-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-placeholder {
  text-align: center;
  font-size: 0.9rem;
  color: #475569;
  padding: 32px 12px;
  background: #f8fafc;
  border-radius: 12px;
}

.drawer-placeholder.error {
  background: #fee2e2;
  color: #b91c1c;
}

.drawer-ship-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drawer-ship-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.drawer-ship-item:hover {
  border-color: #cbd5f5;
  box-shadow: 0 8px 16px rgba(148, 163, 184, 0.18);
}

.drawer-ship-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.drawer-ship-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.drawer-ship-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-ship-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: #0f172a;
}

.drawer-ship-sn {
  font-size: 0.8rem;
  color: #475569;
}

.drawer-footer {
  padding: 16px 24px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-selected {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #1e293b;
  font-size: 0.9rem;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drawer-alert {
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 0.85rem;
  font-weight: 500;
}

.drawer-alert.error {
  background: #fee2e2;
  color: #b91c1c;
}

.drawer-alert.success {
  background: #dcfce7;
  color: #047857;
}

.spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-top-color: rgba(255, 255, 255, 1);
  animation: spin 1s linear infinite;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .filters-card {
    grid-template-columns: 1fr;
  }

  .users-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    align-self: stretch;
    justify-content: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
