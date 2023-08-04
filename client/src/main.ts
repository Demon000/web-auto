import App from './App.vue';
import { createApp } from 'vue';
import './style.css';

const app = createApp(App);

app.mount('#app');

console.log('bla');

window.api.receive('main-process-message', (...args: any) => () => {
    console.log(args);
});
