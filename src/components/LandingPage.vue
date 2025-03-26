<script setup lang="ts">
import { ref } from 'vue';
import LoginForm from './LoginForm.vue';

const showLoginForm = ref(false);

function handleGetStarted() {
  showLoginForm.value = true;
}

function handleCloseLoginForm() {
  showLoginForm.value = false;
}
</script>

<template>
  <div class="landing-hero">
    <h1 class="landing-title winky-sans-900">The first toot scheduling <br>service of all time!</h1>

    <button class="landing-button" @click="handleGetStarted">Get started</button>
    <p class="landing-subtitle">An instance account is required.</p>
  </div>

  <main>
  <div class="landing-how-it-works">  
    <h2 class="winky-sans-700">How to schedule a toot?</h2>
    <div class="landing-how-it-works-steps">
      <p class="step-one">Sign in to your instance account</p>
      <p class="step-two">Write a toot and schedule it</p>
      <p class="step-three">Relax, your toot posts automatically</p>
    </div>
  </div>
  
  <section class="frequently-asked-questions">
    <h2 class="winky-sans-700">Frequently Asked Questions</h2>
    <div>
      <details open>
        <summary class="winky-sans-700">Why use this service?</summary>
        <p>It's easy to use and it's good looking.</p>
      </details>
      <details>
        <summary class="winky-sans-700">Is it free?</summary>
        <p>Yes, it's completely free. No hidden fees. Virtual hugs appreciated!</p>
      </details>
      <details>
        <summary class="winky-sans-700">Is it totally secure?</summary>
        <p>Yes, it is. All scheduled toots are stored on your account's instance. We don't store any goddamn thing!</p>
      </details>
      <details>
        <summary class="winky-sans-700">How do I schedule a toot?</summary>
        <p>It's easy. Just login with your instance account and start scheduling your toots today!</p>
      </details>
      <details>
        <summary class="winky-sans-700">First scheduling toot service, really?</summary>
        <p>Yep, sort of. I'm all into this fake it till you make it thing.</p>
      </details>
    </div>
  </section>

  <div v-if="showLoginForm" class="login-modal">
    <div class="login-modal-overlay" @click="handleCloseLoginForm"></div>
    <div class="login-modal-content">
      <button class="close-button" @click="handleCloseLoginForm">&times;</button>
      <LoginForm />
    </div>
  </div>
</main>
</template>

<style>
.landing-hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 25vh;
  background: radial-gradient(closest-side, antiquewhite 10%, white 100%);
  width: 100%;
  padding: 10rem 0 2rem;
}

.landing-title {
  font-size: 4rem;
  line-height: 1;
  text-align: center;
  margin-bottom: 2rem;
}

.landing-subtitle {
  font-size: 0.6rem;
  text-align: center;
  margin-top: 0.4rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.landing-button {
  margin-top: 1rem;
  background-color: #333;
  border: none;
  color: #fff;
  padding: 1rem 3.6rem;
  border-radius: 3rem;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.landing-button:hover {
  background-color: #444;
}

.landing-how-it-works {
  margin-bottom:7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
}

.landing-how-it-works h2 {
  font-size: 2.8rem;
  margin-bottom: 1rem;
}

.step-one,
.step-two,
.step-three {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

.step-one:before,
.step-two:before,
.step-three:before {
  font-family: "Winky Sans", sans-serif;
  font-size: 1.8rem;
  display: inline-block;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background-color: #333;
  color: #e1e1e1;
  margin-right: 0.5rem;
  text-align: center;
  line-height: 2.7rem;
  font-weight: 700;
}

.step-one:before {
  content: "1";
}

.step-two:before {
  content: "2";
}

.step-three:before {
  content: "3";
}

.frequently-asked-questions {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  background-color: #f0f0f0;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
}

.frequently-asked-questions h2 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
}

.frequently-asked-questions details {
  background-color: #fff;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.frequently-asked-questions details summary {
  cursor: pointer;
  color: #333;
  margin-bottom: 0.5rem;
}

/* Login Modal Styles */
.login-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.login-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.login-modal-content {
  position: relative;
  background-color: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  line-height: 1;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background-color: #f0f0f0;
  color: #333;
}

@media (max-width: 768px) {
  .landing-title {
    font-size: 2.5rem;
  }
  
  .landing-how-it-works h2 {
    font-size: 2rem;
  }
  
  .login-modal-content {
    width: 95%;
    padding: 1.5rem;
  }
}
</style>