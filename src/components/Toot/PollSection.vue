<script setup lang="ts">
import { ref, watch } from 'vue';

interface PollSectionProps {
  modelValue?: {
    options: string[];
    expiresIn: number;
    multiple: boolean;
    hideTotals: boolean;
  };
}

const props = withDefaults(defineProps<PollSectionProps>(), {
  modelValue: () => ({
    options: ['', ''],
    expiresIn: 86400,
    multiple: false,
    hideTotals: false
  })
});

const emit = defineEmits<{
  'update:modelValue': [value: PollSectionProps['modelValue']]
}>();

const pollOptions = ref<string[]>(props.modelValue.options);
const pollExpiresIn = ref(props.modelValue.expiresIn);
const pollMultiple = ref(props.modelValue.multiple);
const pollHideTotals = ref(props.modelValue.hideTotals);

function addPollOption() {
  if (pollOptions.value.length < 4) {
    pollOptions.value.push('');
    emitUpdate();
  }
}

function removePollOption(index: number) {
  if (pollOptions.value.length > 2) {
    pollOptions.value.splice(index, 1);
    emitUpdate();
  }
}

function emitUpdate() {
  emit('update:modelValue', {
    options: pollOptions.value,
    expiresIn: pollExpiresIn.value,
    multiple: pollMultiple.value,
    hideTotals: pollHideTotals.value
  });
}

// Watch for changes in the model value
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    pollOptions.value = newValue.options;
    pollExpiresIn.value = newValue.expiresIn;
    pollMultiple.value = newValue.multiple;
    pollHideTotals.value = newValue.hideTotals;
  }
}, { deep: true });

// Watch for changes in our local refs
watch([pollOptions, pollExpiresIn, pollMultiple, pollHideTotals], () => {
  emitUpdate();
}, { deep: true });
</script>

<template>
  <div class="poll-section">
    <div class="poll-options">
      <div v-for="(_, index) in pollOptions" :key="index" :data-index="index + 1" class="poll-option" :class="{ 'poll-option--multiple': pollMultiple }">
        <input
          v-model="pollOptions[index]"
          type="text"
          placeholder="Poll option"
          required
        />
        <button class="pull-option_button_remove" v-if="pollOptions.length > 2" aria-label="Remove this option" @click="removePollOption(index)">&times;</button>
      </div>

      <button class="add-poll-button" v-if="pollOptions.length < 4" @click="addPollOption">Add Option</button>
    </div>

    <div class="poll-settings">
      <label>
        Poll Duration:
        <select v-model="pollExpiresIn">
          <option value="300">5 minutes</option>
          <option value="3600">1 hour</option>
          <option value="21600">6 hours</option>
          <option value="43200">12 hours</option>
          <option value="86400">1 day</option>
          <option value="259200">3 days</option>
          <option value="604800">7 days</option>
        </select>
      </label>
      <label>
        <input v-model="pollMultiple" type="checkbox" />
        Allow multiple votes
      </label>
      <label>
        <input v-model="pollHideTotals" type="checkbox" />
        Hide totals until poll ends
      </label>
    </div>
  </div>
</template>

<style scoped>
.poll-section {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: .5rem;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.poll-option {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 0.5rem;
}

.poll-option > input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.poll-option::before {
  border-radius: 50%;
  width: 1.4rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  content: attr(data-index);
  font-weight: bold;
  transition: all 0.2s ease;
}

.poll-option:first-child::before {
  background-color: #333;
  color: white;
}
.poll-option::before {
  border: 2px solid #333;
  background-color: white;
  color: #333;
}

.poll-option--multiple::before {
  background-color: #333;
  color: white;
  border-radius: 0.3rem;
}

.pull-option_button_remove {
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 1.5rem;
  width: 1.4rem;
  height: 1.4rem;
  cursor: pointer;
  line-height: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poll-settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.poll-settings label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.add-poll-button {
  background-color: #333;
  color: white;
  border: none;
  padding: 0.8rem 1rem;
  border-radius: 3rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.3s ease;
  width: 100%;
}
.add-poll-button:hover {
  background-color: #222;
}
</style> 