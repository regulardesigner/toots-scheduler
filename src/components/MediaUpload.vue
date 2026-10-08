<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MastodonMediaAttachment } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';
import ModalView from './Modals/ModalView.vue';
import { useInstanceStore } from '../stores/instance';
import { logError } from '../utils/logError';
import { acceptedImageFiles, describeImageTypes, formatMegabytes, getImageRejection, type ImageLimits } from '../utils/media';

const props = defineProps<{
  modelValue: MastodonMediaAttachment[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: MastodonMediaAttachment[]): void;
}>();

const api = useMastodonApi();
const instance = useInstanceStore();
const isUploading = ref(false);
const uploadError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const editingMediaIndex = ref<number | null>(null);
const mediaDescription = ref('');
const isDragging = ref(false);
/** Upload progress per upload, keyed by a random id (two files can share a name). */
const uploadProgress = ref<Record<string, { name: string; percent: number }>>({});

/** The signed-in instance's image limits (Mastodon's defaults until it answers). */
const imageLimits = computed<ImageLimits>(() => ({
  imageTypes: instance.supportedMimeTypes,
  maxImageBytes: instance.imageSizeLimit,
}));

/** "4 images" or "1 image". */
const maxImagesLabel = computed(() => `${instance.maxMediaAttachments} ${instance.maxMediaAttachments === 1 ? 'image' : 'images'}`);

const uploadHint = computed(() =>
  `Up to ${maxImagesLabel.value}, max ${formatMegabytes(instance.imageSizeLimit)} MB each (${describeImageTypes(instance.supportedMimeTypes)})`,
);

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  
  const files = Array.from(input.files);
  // Allows picking the same file again (e.g. after an error).
  input.value = '';
  await uploadFiles(files);
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  
  await uploadFiles(Array.from(files));
}

async function uploadFiles(files: File[]) {
  // One upload at a time: a second drop would work from an outdated list of images.
  if (isUploading.value) return;
  uploadError.value = '';

  // Checked before uploading: drag and drop bypasses the file picker's `accept`.
  const rejection = files.map(file => getImageRejection(file, imageLimits.value)).find(message => message !== null);
  if (rejection) {
    uploadError.value = rejection;
    return;
  }
  if (props.modelValue.length + files.length > instance.maxMediaAttachments) {
    uploadError.value = `Maximum ${maxImagesLabel.value} allowed`;
    return;
  }

  isUploading.value = true;
  // Accumulated locally: the prop only updates after the parent re-renders.
  const attachments = [...props.modelValue];

  let current = '';
  try {
    for (const file of files) {
      current = file.name;
      const key = crypto.randomUUID();
      uploadProgress.value[key] = { name: file.name, percent: 0 };

      const media = await api.uploadMedia(file, (percent) => {
        uploadProgress.value[key] = { name: file.name, percent };
      });

      attachments.push(media);
      emit('update:modelValue', [...attachments]);
      delete uploadProgress.value[key];
    }
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message : 'Failed to upload images';
    uploadError.value = current ? `Could not upload "${current}": ${reason}` : reason;
    logError('Upload error', err);
  } finally {
    isUploading.value = false;
    uploadProgress.value = {};
  }
}

function removeMedia(index: number) {
  if (isUploading.value) return;
  const newMedia = [...props.modelValue];
  newMedia.splice(index, 1);
  emit('update:modelValue', newMedia);
}

function startEditingMedia(index: number) {
  if (isUploading.value) return;
  editingMediaIndex.value = index;
  const media = props.modelValue[index];
  mediaDescription.value = media.description || '';
}

async function saveMediaMetadata() {
  if (editingMediaIndex.value === null) return;

  try {
    const media = props.modelValue[editingMediaIndex.value];
    const updatedMedia = await api.updateMediaMetadata(
      media.id,
      mediaDescription.value,
    );
    
    const newMedia = [...props.modelValue];
    newMedia[editingMediaIndex.value] = updatedMedia;
    emit('update:modelValue', newMedia);
    editingMediaIndex.value = null;
  } catch (err) {
    logError('Error updating media metadata', err);
    const reason = err instanceof Error && err.message ? err.message : 'unknown error';
    uploadError.value = `Could not save the description: ${reason}`;
  }
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
      @click="!isUploading && fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="acceptedImageFiles(instance.supportedMimeTypes)"
        multiple
        class="hidden"
        @change="handleFileSelect"
      >
      <div class="upload-content">
        <p>Drag & drop images here or click to select</p>
        <p class="upload-hint">
          {{ uploadHint }}
        </p>
      </div>
    </div>

    <!-- Upload Progress Section -->
    <div
      v-if="Object.keys(uploadProgress).length > 0"
      class="upload-progress"
    >
      <div
        v-for="(progress, key) in uploadProgress"
        :key="key"
        class="progress-item"
      >
        <div class="progress-info">
          <span class="file-name">{{ progress.name }}</span>
          <span class="progress-percentage">{{ Math.round(progress.percent) }}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progress.percent}%` }"
          />
        </div>
      </div>
    </div>

    <div
      v-if="modelValue.length > 0"
      class="media-preview"
    >
      <div 
        v-for="(media, index) in modelValue" 
        :key="media.id" 
        class="preview-item"
        :class="{ 'is-editing': editingMediaIndex === index }"
      >
        <div class="preview-image-wrapper">
          <img 
            v-if="media.preview_url"
            :src="media.preview_url" 
            :alt="media.description || ''"
          >
          <div
            v-else
            class="preview-placeholder"
          >
            Processing…
          </div>
          <div class="preview-controls">
            <button 
              type="button" 
              class="edit-alt-button"
              :disabled="isUploading"
              @click="startEditingMedia(index)"
            >
              Alt
            </button>
            
            <button 
              type="button" 
              class="remove-button"
              :disabled="isUploading"
              aria-label="Remove Image"
              @click="removeMedia(index)"
            >
              &times;
            </button>
          </div>
        </div>

        <ModalView
          :is-open="editingMediaIndex === index"
          labelled-by="media-edit-title"
          @close="editingMediaIndex = null"
        >
          <label
            id="media-edit-title"
            class="winky-sans-700 media-edit-label"
            for="media-edit-input"
          >Add a description</label>
          <div class="media-edit-form">
            <img 
              v-if="media.preview_url"
              class="media-edit-image"
              :src="media.preview_url" 
              :alt="media.description || ''"
            >
            <div class="form-group">
              <input
                id="media-edit-input"
                v-model="mediaDescription"
                class="media-edit-input"
                type="text"
                placeholder="Describe the image if necessary"
                @keyup.enter="saveMediaMetadata"
              >
            </div>
            <button 
              type="button" 
              class="save-button"
              @click="saveMediaMetadata"
            >
              Save Alt Text
            </button>
          </div>
        </ModalView>
      </div>
    </div>

    <!-- Always in the DOM, only its content changes: Safari ignores an alert inserted already filled. -->
    <div role="alert">
      <p
        v-if="uploadError"
        class="error"
      >
        {{ uploadError }}
      </p>
    </div>
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
  grid-template-columns: repeat(auto-fill, calc(25% - (3rem / 4)));
  gap: 1rem;
  margin-top: 1rem;
}

.preview-item {
  position: relative;
  background: white;
  background-size: cover;
  background-position: center;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 100px;
  background-color: #f8f8f8;
  color: #666;
  font-size: 0.9rem;
}

.preview-image-wrapper {
  position: relative;
  aspect-ratio: 5 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.edit-alt-button,
.remove-button {
  position: absolute;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-alt-button {
  bottom: 0.4rem;
  left: 0.4rem;
  background-color: #333;
  color: white;
  border-radius: 0.3rem;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.1rem 0.3rem;
}

.remove-button {
  top: 0.4rem;
  right: 0.4rem;
  width: 1.2rem;
  height: 1.2rem;
  background-color: #c0392b;
  color: white;
  border-radius: 1.2rem;
}

.media-edit-label {
  font-size: 2rem;
}

.media-edit-image {
  border-radius: 0.3rem;
  border: 1px solid #ccc;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-edit-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 0.3rem;
  font-size: 1rem;
}

.save-button {
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