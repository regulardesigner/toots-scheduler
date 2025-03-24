<script setup lang="ts">
import { format } from 'date-fns';

interface Props {
  id: string;
  scheduledAt: string;
  text?: string;
  visibility?: string;
  language?: string;
  isLoading?: boolean;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string) => void;
}

const props = defineProps<Props>();

const languages = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  nl: 'Nederlands',
  pl: 'Polski',
  ar: 'العربية',
  hi: 'हिन्दी',
} as const;

function formatDateTime(date: string) {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

function getCapitalizedVisibility(visibility: string | undefined): string {
  if (!visibility) return 'Public';
  return visibility.charAt(0).toUpperCase() + visibility.slice(1);
}

function getLanguageName(code: string | undefined): string {
  if (!code) return 'Unknown';
  return languages[code as keyof typeof languages] || code;
}
</script>

<template>
  <div class="toot-card">
    <div class="toot-header">
      <div class="meta-row">
        <span class="meta-label">Scheduled for:
          {{ formatDateTime(props.scheduledAt) }}
        </span>
      </div>
      <div class="actions">
        <button 
          class="edit-button" 
          @click="props.onEdit(props.id)"
          :disabled="props.isLoading"
        >
          {{ props.isLoading ? 'Editing...' : 'Edit' }}
        </button>
        <button 
          class="delete-button" 
          @click="props.onDelete(props.id)"
          :disabled="props.isLoading"
        >
          {{ props.isLoading ? 'Deleting...' : 'Delete' }}
        </button>
      </div>
    </div>

    <div class="toot-content">{{ props.text }}</div>

    <div class="toot-footer">
      {{ getCapitalizedVisibility(props.visibility) }} toot in {{ getLanguageName(props.language) }}
    </div>
  </div>
</template>

<style scoped>
.toot-card {
  background-color: #f5f5f5;
  border-radius: 0.5rem;
  padding: 1rem;
  border: none;
}

.toot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

.meta-label {
  color: #666;
  font-weight: 500;
}

.toot-content {
  font-size: 1rem;
  line-height: 1.5;
  color: #333;
  margin: 0.5rem 0;
  padding: 0.75rem;
  background-color: white;
  border-radius: 0.5rem;
  border: none;
}

.toot-footer {
  color: #666;
  font-size: 0.8rem;
  text-transform: capitalize;
  font-weight: 700;
  margin-top: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.edit-button {
  padding: 0.5rem 1rem;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.edit-button:hover:not(:disabled) {
  background-color: #666;
}

.edit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.delete-button {
  padding: 0.5rem 1rem;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-button:hover:not(:disabled) {
  background-color: #666;
}

.delete-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .toot-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  
  .edit-button,
  .delete-button {
    width: 100%;
  }

  .meta-row {
    flex-direction: row;
    align-items: center;
  }
}
</style> 