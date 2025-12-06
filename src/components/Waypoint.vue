<template>
  <div v-if="showModal" class="modal-overlay">
    <div class="modal-content">
      <h3>Tambah Waypoint</h3>
      
      <!-- Input Mode Selector -->
      <div class="input-mode-selector">
        <button 
          type="button" 
          :class="['mode-btn', { active: inputMode === 'latlng' }]" 
          @click="inputMode = 'latlng'"
        >
          Lat/Lng (Decimal)
        </button>
        <button 
          type="button" 
          :class="['mode-btn', { active: inputMode === 'dms' }]" 
          @click="inputMode = 'dms'"
        >
          DMS (Degrees, Minutes, Seconds)
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <!-- Lat/Lng Input Mode -->
        <div v-if="inputMode === 'latlng'" class="modal-row">
          <div>
            <label>Nama Waypoint</label>
            <input v-model="waypointForm.name" type="text" placeholder="Masukkan identifier waypoint" required />
          </div>
          <div>
            <label>Latitude (Decimal)</label>
            <input v-model.number="waypointForm.lat" type="number" step="0.000001" placeholder="-6.123456" required />
          </div>
          <div>
            <label>Longitude (Decimal)</label>
            <input v-model.number="waypointForm.lng" type="number" step="0.000001" placeholder="106.123456" required />
          </div>
        </div>

        <!-- DMS Input Mode -->
        <div v-if="inputMode === 'dms'" class="modal-row">
          <div>
            <label>Nama Waypoint</label>
            <input v-model="dmsForm.name" type="text" placeholder="Masukkan identifier waypoint" required />
          </div>
          
          <div class="dms-group">
            <label>Latitude DMS</label>
            <div class="dms-inputs">
              <input v-model.number="dmsForm.latDeg" type="number" placeholder="0" min="0" max="90" step="1" required />
              <span>°</span>
              <input v-model.number="dmsForm.latMin" type="number" placeholder="0" min="0" max="59" step="1" required />
              <span>'</span>
              <input v-model.number="dmsForm.latSec" type="number" placeholder="0.000" min="0" max="59.999" step="0.001" required />
              <span>"</span>
              <select v-model="dmsForm.latDir" required>
                <option value="N">N</option>
                <option value="S">S</option>
              </select>
            </div>
          </div>

          <div class="dms-group">
            <label>Longitude DMS</label>
            <div class="dms-inputs">
              <input v-model.number="dmsForm.lngDeg" type="number" placeholder="0" min="0" max="180" step="1" required />
              <span>°</span>
              <input v-model.number="dmsForm.lngMin" type="number" placeholder="0" min="0" max="59" step="1" required />
              <span>'</span>
              <input v-model.number="dmsForm.lngSec" type="number" placeholder="0.000" min="0" max="59.999" step="0.001" required />
              <span>"</span>
              <select v-model="dmsForm.lngDir" required>
                <option value="E">E</option>
                <option value="W">W</option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" @click="handleClose" class="cancel-btn">Batal</button>
          <button type="submit" class="save-btn">Simpan</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  name: "Waypoint",
  props: {
    showModal: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      inputMode: "dms", // "latlng" or "dms"
      waypointForm: {
        name: "",
        lat: "",
        lng: "",
      },
      dmsForm: {
        name: "",
        latDeg: 0,
        latMin: 0,
        latSec: 0,
        latDir: "N",
        lngDeg: 0,
        lngMin: 0,
        lngSec: 0,
        lngDir: "E",
      },
    };
  },
  methods: {
    handleSubmit() {
      let name, lat, lng;

      if (this.inputMode === 'latlng') {
        name = this.waypointForm.name;
        lat = Math.round(Number(this.waypointForm.lat) * 100000000) / 100000000;
        lng = Math.round(Number(this.waypointForm.lng) * 100000000) / 100000000;
      } else {
        name = this.dmsForm.name;
        try {
          lat = this.convertDMSToDecimal(
            Number(this.dmsForm.latDeg), 
            Number(this.dmsForm.latMin), 
            Number(this.dmsForm.latSec), 
            this.dmsForm.latDir
          );
          lng = this.convertDMSToDecimal(
            Number(this.dmsForm.lngDeg), 
            Number(this.dmsForm.lngMin), 
            Number(this.dmsForm.lngSec), 
            this.dmsForm.lngDir
          );
          lat = Math.round(lat * 100000000) / 100000000;
          lng = Math.round(lng * 100000000) / 100000000;
        } catch (error) {
          alert("Error: " + error.message);
          return;
        }
      }

      if (!name || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert("Nama waypoint dan koordinat harus valid!");
        return;
      }

      this.$emit('add-waypoint', { name, lat, lng });
      this.handleClose();
    },
    handleClose() {
      this.inputMode = "dms";
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
      this.$emit('close-modal');
    },
    convertDMSToDecimal(degrees, minutes, seconds, direction) {
      if (degrees === "" || minutes === "" || seconds === "" || direction === "") {
        throw new Error("Semua field DMS harus diisi");
      }

      const deg = parseFloat(degrees);
      const min = parseFloat(minutes);
      const sec = parseFloat(seconds);

      if (isNaN(deg) || isNaN(min) || isNaN(sec)) {
        throw new Error("Derajat, menit, dan detik harus berupa angka");
      }

      if (deg < 0 || deg > 180) {
        throw new Error(`Derajat ${deg} tidak valid. Harus antara 0-180`);
      }
      if (min < 0 || min >= 60) {
        throw new Error(`Menit ${min} tidak valid. Harus antara 0-59`);
      }
      if (sec < 0 || sec >= 60) {
        throw new Error(`Detik ${sec} tidak valid. Harus antara 0-59.999`);
      }
      if (!['N', 'S', 'E', 'W'].includes(direction.toUpperCase())) {
        throw new Error(`Arah ${direction} tidak valid. Harus N, S, E, atau W`);
      }

      const decimal = deg + (min / 60.0) + (sec / 3600.0);
      const finalDecimal = (direction.toUpperCase() === 'S' || direction.toUpperCase() === 'W') 
        ? -decimal 
        : decimal;

      return Math.round(finalDecimal * 100000000) / 100000000;
    },
  },
};
</script>

<style scoped>
/* Include the modal-related styles from App.vue */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 16px;
  padding: 32px 32px 24px 32px;
  min-width: 480px;
  max-width: 600px;
  box-shadow: 0 2px 24px rgba(0,0,0,0.12);
}
.modal-content h3 {
  margin-bottom: 18px;
  font-size: 1.2rem;
  font-weight: 600;
  color: #222;
}
.modal-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 18px;
}
.modal-row > div {
  display: flex;
  flex-direction: column;
}
.modal-row label {
  display: block;
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 6px;
  color: #222;
}
.modal-row input {
  color: #222;
  background: #f3f8fa;
  display: block;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e3e3e3;
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.cancel-btn {
  background: #eee;
  color: #222;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-weight: 500;
  cursor: pointer;
}
.save-btn {
  background: #222;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-weight: 600;
  cursor: pointer;
}
.save-btn:hover {
  background: #444;
}
.input-mode-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding: 4px;
  background: #f3f4f6;
  border-radius: 8px;
}
.mode-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.mode-btn.active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.dms-group {
  margin-bottom: 16px;
}
.dms-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.dms-inputs input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #e3e3e3;
  border-radius: 4px;
  text-align: center;
  font-size: 0.9rem;
}
.dms-inputs select {
  width: 50px;
  padding: 6px 4px;
  border: 1px solid #e3e3e3;
  border-radius: 4px;
  text-align: center;
  font-size: 0.9rem;
}
.dms-inputs span {
  font-weight: 600;
  color: #374151;
  position: relative;
  top: -3px;
  font-size: 1.1em;
}
</style>

