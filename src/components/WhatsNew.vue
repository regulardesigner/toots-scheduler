<script setup lang="ts">
import { useFeaturesStore } from '../stores/features';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

const featuresStore = useFeaturesStore();
const { newFeatures } = storeToRefs(featuresStore);

const isFirstVisit = computed(() => {
  return !localStorage.getItem('masto-publish-later-features');
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function handleClose() {
  featuresStore.markFeaturesAsSeen();
  emit('close');
}
</script>

<template>
  <div class="whats-new-modal">
    <div class="whats-new-content">
      <button class="close-button" @click="handleClose">&times;</button>
      <h2 class="winky-sans-700">{{ isFirstVisit ? "What's new" : "What's new since last time!" }}</h2>
      <div v-if="newFeatures.length === 0" class="no-new-features">
        No new features to show.
      </div>
      <div v-else class="features-list">
        <div v-for="group in newFeatures" :key="group.version" class="feature-group">
          <div class="version-header">
            <h3 class="winky-sans-500">In version {{ group.version }}</h3>
            <span class="release-date">{{ group.date }}</span>
          </div>
          <div class="features">
            <div v-for="feature in group.features" :key="feature.id" class="feature-item">
              <h4>{{ feature.title }}</h4>
              <p>{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </div>
      <button @click="handleClose" class="close-whats-new-modal-button">
        Got it!
      </button>
    </div>
  </div>
</template>

<style scoped>
.whats-new-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.whats-new-content {
  background-color: white;
  border-radius: 1rem;
  max-width: 500px;
  padding: 2rem;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h2 {
  font-size: 2rem;
  margin-top: 0;
  color: #333;
}

.features-list {
  margin: 0.5rem 0 1.5rem;
}

.feature-group {
  margin-bottom: 1.2rem;
}

.feature-group:last-child {
  margin-bottom: 0;
}

.version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 2px dashed #eee;
}

.version-header h3 {
  margin: 0;
  color: #333;
  font-size: 1rem;
}

.release-date {
  color: #666;
  font-size: 0.8rem;
}

.feature-item {
  padding: 0.4rem 0 0;
}

.feature-item:last-child {
  padding-bottom: 0;
}

.feature-item h4 {
  color: #333;
  font-size: 1rem;
}

.feature-item p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.close-whats-new-modal-button {
  margin-top: 1rem;
  background-color: #333;
  width: 100%;
  border: none;
  color: #fff;
  padding: 0.8rem 3.6rem;
  border-radius: 3rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clos-whats-new-modal-button:hover {
  background-color: #444;
}

.no-new-features {
  text-align: center;
  color: #666;
  padding: 2rem 0;
}
</style> 