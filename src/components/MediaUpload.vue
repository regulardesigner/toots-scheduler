<script setup lang="ts">
import { ref } from 'vue';
import type { MastodonMediaAttachment } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';

const props = defineProps<{
  modelValue: MastodonMediaAttachment[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: MastodonMediaAttachment[]): void;
}>();

const api = useMastodonApi();
const isUploading = ref(false);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const editingMediaIndex = ref<number | null>(null);
const mediaDescription = ref('');
const mediaFocus = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const uploadProgress = ref<{ [key: string]: number }>({});

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  
  await uploadFiles(Array.from(input.files));
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  
  await uploadFiles(Array.from(files));
}

async function uploadFiles(files: File[]) {
  if (props.modelValue.length + files.length > 4) {
    uploadError.value = 'Maximum 4 images allowed';
    return;
  }

  isUploading.value = true;
  uploadError.value = '';

  try {
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        uploadError.value = 'Each image must be less than 8MB';
        continue;
      }

      // Initialize progress for this file
      uploadProgress.value[file.name] = 0;

      const media = await api.uploadMedia(file, (progress) => {
        uploadProgress.value[file.name] = progress;
      });

      emit('update:modelValue', [...props.modelValue, media]);
      
      // Clear progress after successful upload
      delete uploadProgress.value[file.name];
    }
  } catch (err) {
    uploadError.value = 'Failed to upload images';
    console.error('Upload error:', err);
  } finally {
    isUploading.value = false;
    uploadProgress.value = {};
  }
}

function removeMedia(index: number) {
  const newMedia = [...props.modelValue];
  newMedia.splice(index, 1);
  emit('update:modelValue', newMedia);
}

function startEditingMedia(index: number) {
  editingMediaIndex.value = index;
  const media = props.modelValue[index];
  mediaDescription.value = media.description || '';
  mediaFocus.value = media.focus || { x: 0, y: 0 };
}

async function saveMediaMetadata() {
  if (editingMediaIndex.value === null) return;

  try {
    const media = props.modelValue[editingMediaIndex.value];
    const updatedMedia = await api.updateMediaMetadata(
      media.id,
      mediaDescription.value,
      mediaFocus.value
    );
    
    const newMedia = [...props.modelValue];
    newMedia[editingMediaIndex.value] = updatedMedia;
    emit('update:modelValue', newMedia);
    editingMediaIndex.value = null;
  } catch (err) {
    console.error('Error updating media metadata:', err);
    uploadError.value = 'Failed to update image details';
  }
}

function handleFocusPointClick(event: MouseEvent, index: number) {
  if (editingMediaIndex.value !== index) return;
  
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  
  mediaFocus.value = { x, y };
}
</script>

<template>
  <div class="media-upload">
    <div 
      class="upload-area"
      :class="{ 'is-dragging': isDragging, 'is-uploading': isUploading }"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @dragover.prevent
      @drop.prevent="handleDrop"
      @click="fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        @change="handleFileSelect"
        class="hidden"
      />
      <div class="upload-content">
        <p>Drag & drop images here or click to select</p>
        <p class="upload-hint">Up to 4 images, max 8MB each</p>
      </div>
    </div>

    <!-- Upload Progress Section -->
    <div v-if="Object.keys(uploadProgress).length > 0" class="upload-progress">
      <div v-for="(progress, fileName) in uploadProgress" :key="fileName" class="progress-item">
        <div class="progress-info">
          <span class="file-name">{{ fileName }}</span>
          <span class="progress-percentage">{{ Math.round(progress) }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
    </div>

    <div v-if="modelValue.length > 0" class="media-preview">
      <div 
        v-for="(media, index) in modelValue" 
        :key="media.id" 
        class="preview-item"
        :class="{ 'is-editing': editingMediaIndex === index }"
      >
        <div class="preview-image-wrapper" @click="handleFocusPointClick($event, index)">
          <img 
            :src="media.preview_url" 
            :alt="media.description || 'Uploaded image'"
            :style="{
              objectPosition: `${media.focus?.x || 0}% ${media.focus?.y || 0}%`
            }"
          />
          <div v-if="editingMediaIndex === index" class="focus-point" :style="{
            left: `${mediaFocus.x}%`,
            top: `${mediaFocus.y}%`
          }"></div>
        </div>
        
        <div class="preview-controls">
          <button 
            type="button" 
            class="edit-button"
            @click="startEditingMedia(index)"
          >
            {{ editingMediaIndex === index ? 'Save' : 'Edit' }}
          </button>
          <button 
            type="button" 
            class="remove-button"
            @click="removeMedia(index)"
          >
            Remove
          </button>
        </div>

        <div v-if="editingMediaIndex === index" class="media-edit-form">
          <div class="form-group">
            <label>Alt text</label>
            <input
              type="text"
              v-model="mediaDescription"
              placeholder="Describe this image"
              @keyup.enter="saveMediaMetadata"
            />
          </div>
          <button 
            type="button" 
            class="save-button"
            @click="saveMediaMetadata"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>

    <p v-if="uploadError" class="error">{{ uploadError }}</p>
  </div>
</template>

<style scoped>
.media-upload {
  margin-bottom: 1rem;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 0.5rem;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #f8f8f8;
}

.upload-area.is-dragging {
  border-color: #2b90d9;
  background-color: #f0f7ff;
  transform: scale(1.02);
}

.upload-area.is-uploading {
  border-color: #2b90d9;
  background-color: #f0f7ff;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { background-color: #f0f7ff; }
  50% { background-color: #d7e9fc; }
  100% { background-color: #f0f7ff; }
}

.upload-content {
  pointer-events: none; /* Allows mouse events to pass through to parent elements */  
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-hint {
  color: #666;
  font-size: 0.9rem;
}

.upload-progress {
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: 0.5rem;
}

.progress-item {
  margin-bottom: 0.5rem;
}

.progress-item:last-child {
  margin-bottom: 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.file-name {
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-percentage {
  color: #666;
  font-weight: 500;
}

.progress-bar {
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #2b90d9;
  transition: width 0.3s ease;
}

.media-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.preview-item {
  position: relative;
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.preview-image-wrapper {
  position: relative;
  aspect-ratio: 1;
  cursor: crosshair;
}

.preview-image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.focus-point {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #2b90d9;
  border: 2px solid white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.preview-controls {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0,0,0,0.05);
}

.edit-button,
.remove-button {
  flex: 1;
  padding: 0.25rem;
  font-size: 0.8rem;
  border-radius: 0.25rem;
}

.edit-button {
  background-color: #2b90d9;
  color: white;
}

.remove-button {
  background-color: #ff4136;
  color: white;
}

.media-edit-form {
  padding: 0.5rem;
  background: white;
  border-top: 1px solid #eee;
}

.save-button {
  width: 100%;
  margin-top: 0.5rem;
  background-color: #2b90d9;
  color: white;
}

.hidden {
  display: none;
}

@media (max-width: 768px) {
  .media-preview {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
</style> 