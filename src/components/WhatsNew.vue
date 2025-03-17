<script setup lang="ts">
import { useFeaturesStore } from '@/stores/features';
import { storeToRefs } from 'pinia';

const featuresStore = useFeaturesStore();
const { newFeatures } = storeToRefs(featuresStore);

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
      <h2>What's New</h2>
      <div v-if="newFeatures.length === 0" class="no-new-features">
        No new features to show.
      </div>
      <div v-else class="features-list">
        <div v-for="group in newFeatures" :key="group.version" class="feature-group">
          <div class="version-header">
            <h3>Version {{ group.version }}</h3>
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
      <button @click="handleClose" class="close-button">
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
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.whats-new-content {
  background-color: white;
  padding: 0.8rem 1.2rem 1.2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

h2 {
  margin-top: 0;
  color: #2c3e50;
}

.features-list {
  margin: 0.5rem 0;
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
  border-bottom: 2px solid #eee;
}

.version-header h3 {
  margin: 0;
  color: #2c3e50;
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
  color: #2c3e50;
  font-size: 0.9rem;
}

.feature-item p {
  margin: 0;
  color: #666;
  font-size: 0.8rem;
}

.close-button {
  background-color: #4CAF50;
  color: white;
  border: 1px solid #207223;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: #45a049;
}

.no-new-features {
  text-align: center;
  color: #666;
  padding: 2rem 0;
}
</style> 