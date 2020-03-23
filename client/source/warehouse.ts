import { Client } from './client.js';

window.addEventListener('DOMContentLoaded', event => {
    const client =  new Client();
    client.start();
});