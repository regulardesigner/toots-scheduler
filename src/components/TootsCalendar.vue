<script setup lang="ts">
import { useScheduledTootsStore } from '../stores/scheduledToots';
import { ref, computed } from 'vue';

const store = useScheduledTootsStore();

const toots = ref(store.sortedToots);

// state for the current month and year
const currentDate = ref(new Date());

const today = new Date();

// navigate to the previous month
function goToPreviousMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1);
}

// navigate to the next month
function goToNextMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1);
}

// get the current month name
const currentMonthName = computed(() => {
  return currentDate.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
});

// calculate the number of empty days before the first day of the month
const emptyDaysBeforeFirstDayOfMonth = computed(() => {
  return new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 0).getDay();
});

// calculate the number of empty days to fill
const emptyDaysToFill = computed(() => {
  return 7 - (emptyDaysBeforeFirstDayOfMonth.value + generateCalendar.value.length) % 7;
});

// generate the calendar
const generateCalendar = computed(() => {
  const calendar = [];
  const todayMonth = currentDate.value.getMonth();
  const todayYear = currentDate.value.getFullYear();

  const daysInMonth = new Date(todayYear, todayMonth + 1, 0).getDate();

  for (let i = 0; i < daysInMonth; i++) {
    const date = new Date(Date.UTC(todayYear, todayMonth, i + 1));
    calendar.push(date);
  }

  return calendar;
});

// check if the date is in the toots.scheduled_at array
const isScheduled = (date: Date) => {
  const formattedDate = date.toISOString().split('T')[0];

  return toots.value.some(toot => {
    const scheduledDate = toot.scheduled_at?.split('T')[0];
    return scheduledDate === formattedDate;
  });
};

const isBeforeToday = (date: Date) => {
  // Check if the date is before today
  // Use toISOString to compare dates in UTC
  // This ensures that the time part is ignored and only the date part is compared
  // to avoid timezone issues
  const todayDate = new Date(today.toISOString().split('T')[0]);
  date = new Date(date.toISOString().split('T')[0]);

  return date < todayDate;
};

const isToday = (date: Date) => {
  return date.toDateString() === today.toDateString();
};


</script>

<template>
  <div class="calendar-container">
    <div class="calendar-header">
      <button v-if="currentDate > today" class="nav-button" @click.prevent="goToPreviousMonth">&larr;</button>
      <h2 class="winky-sans-700">{{ currentMonthName }}</h2>
      <button class="nav-button" @click.prevent="goToNextMonth">&rarr;</button>
    </div>
    <div class="calendar-grid">
      <div class="empty-day" v-for="i in emptyDaysBeforeFirstDayOfMonth" :key="i" />
      <div class="calendar-day" v-for="date in generateCalendar" :key="date.toISOString()" :class="{ 'scheduled': isScheduled(date), 'past-day': isBeforeToday(date), 'today': isToday(date) }">
        {{ new Date(date).toLocaleDateString('fr-FR', { day: 'numeric' }) }}
      </div>
      <div class="empty-day" v-for="i in emptyDaysToFill" :key="i" />
    </div>
  </div>
</template>

<style scoped>
.calendar-container {
  padding: 1rem;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.nav-button {
  background-color: antiquewhite;
  border: none;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.2s;
}

.nav-button:hover {
  background-color: #e6d5c3;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.3rem;
  padding: 0.3rem;
}

.calendar-day, .empty-day {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: antiquewhite;
  padding: 0.3rem;
  aspect-ratio: 1/1;
  border-radius: 0.5rem;
}

.empty-day {
  background-color: white;
  background-color: whitesmoke;
}

.today {
  background-color: #FF9200;
  color: white;
  font-weight: 800;
}

.past-day {
  position: relative;
  background-color: whitesmoke;
  color: #ccc;
}

.past-day::before {
  content: '';
  display: block;
  width: 100%;
  height: 2px;
  rotate: -45deg;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: #ccc;
  border-radius: 1rem;
}

.scheduled { 
  position: relative;
  font-weight: 800;
}

.scheduled::before {
  position: absolute;
  top: 0.2rem;
  right: 0.2rem;
  content: '';
  display: block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background-color: #FF9200;
}
</style>