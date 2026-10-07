import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast, { type PluginOptions, POSITION } from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

const toastOptions: PluginOptions = {
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: true,
  closeButton: 'button',
  icon: true,
  rtl: false,
  position: POSITION.BOTTOM_RIGHT,
  transition: 'Vue-Toastification__bounce',
  maxToasts: 3,
  accessibility: {
    // Not a live region: useNotify speaks every message through App.vue's persistent regions
    // (Safari/VoiceOver ignores the toast's role="alert", inserted already filled; others would read it twice).
    // vue-toastification falls back to "alert" for an empty role, hence "none".
    toastRole: 'none',
    closeButtonLabel: 'Dismiss notification',
  },
}

app.use(createPinia())
app.use(Toast, toastOptions)
app.use(router)

app.mount('#app')
