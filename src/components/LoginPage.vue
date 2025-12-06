<template>
  <div class="login-container">
    <div class="login-card">
      <!-- Logo and Title -->
      <div class="login-header">
        <img src="/Users/rafiyahyaacpridan/Documents/layout_basarnas/src/assets/basarnas.png" class="login-logo" alt="BASARNAS Logo" />
        <h1 class="login-title">Sistem Monitoring Kapal</h1>
        <p class="login-subtitle">Badan Nasional Pencarian dan Pertolongan</p>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="Masukkan email Anda"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <div class="password-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input password-input"
              placeholder="Masukkan password Anda"
              required
              :disabled="isLoading"
            />
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              @click="showPassword = !showPassword"
              :disabled="isLoading"
            >
              <!-- Open eye icon (outline eye with pupil) -->
              <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12c2.5-4.2 6.3-7 10-7s7.5 2.8 10 7c-2.5 4.2-6.3 7-10 7S4.5 16.2 2 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <!-- Closed eye icon (arc with lashes) -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12c3 4 15 4 18 0"/>
                <path d="M7 12l-2 3"/>
                <path d="M12 13v3"/>
                <path d="M17 12l2 3"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="login-btn"
          :disabled="isLoading"
        >
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? 'Sedang Masuk...' : 'Masuk' }}
        </button>
      </form>

      <!-- Footer -->
      <div class="login-footer">
        <p>&copy; 2025 BASARNAS. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { authClient } from '../auth-client'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

const emit = defineEmits(['login-success'])

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Email dan password harus diisi'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await authClient.signIn.email({
      email: email.value,
      password: password.value,
    })

    if (result.error) {
      errorMessage.value = result.error.message || 'Login gagal. Silakan coba lagi.'
    } else {
      emit('login-success', result.data)
    }
  } catch (error) {
    console.error('Login error:', error)
    errorMessage.value = 'Terjadi kesalahan. Silakan coba lagi.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Reset untuk memastikan tidak ada margin/padding default */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.login-card {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  margin: 20px;
  position: relative;
  z-index: 1;
}

.login-header {
  margin-bottom: 40px;
}

.login-logo {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  object-fit: contain;
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: #222;
  margin: 0 0 8px 0;
  letter-spacing: 1px;
}

.login-subtitle {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
  font-weight: 500;
}

.login-form {
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-label {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: #222;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e3e3e3;
  border-radius: 12px;
  font-size: 1rem;
  background: #f3f8fa;
  color: #222;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #4facfe;
  background: #fff;
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 44px; /* space for toggle button */
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
}

.password-toggle:hover:not(:disabled) {
  background: #eef2f7;
  color: #1f2937;
}

.error-message {
  background: #fee;
  color: #d9534f;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.login-footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e3e3e3;
}

.login-footer p {
  font-size: 0.8rem;
  color: #888;
  margin: 0;
}

/* Responsive Design */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
    margin: 10px;
  }

  .login-title {
    font-size: 1.5rem;
  }

  .login-logo {
    width: 60px;
    height: 60px;
  }
}
</style>
