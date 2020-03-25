import * as api from './api.js';
import { LoginRequest } from './common.js';

export class Client {
    async start() {
        this.initializeInterface();
        this.validateSession();
    }

    async validateSession() {
        const response = await api.validateSession();
        if (response.valid === true) {
            await this.showTorrents();
        }
        else {
            this.showLogin();
        }
    }

    show(id: string, show: boolean = true) {
        const element = document.getElementById(id);
        this.showElement(element, show);
    }

    hide(id: string) {
        this.show(id, false);
    }

    showElement(element: HTMLElement, show: boolean = true) {
        element.style.display = show === true ? 'block' : 'none';
    }

    hideElement(element: HTMLElement) {
        this.showElement(element, false);
    }

    initializeInterface() {
        this.initializeLogin();
        this.initializeMenu();
        this.initializeTorrents();
    }

    initializeLogin() {
        const inputElements = document.querySelectorAll('#login input');
        inputElements.forEach(element => {
            const inputElement = <HTMLInputElement>element;
            inputElement.onkeypress = this.onLoginKeyPress.bind(this);
        });
        const loginButton = document.querySelector<HTMLButtonElement>('#login button');
        loginButton.onclick = this.onLoginClick.bind(this);
    }

    initializeMenu() {
        const inputElement = document.querySelector<HTMLInputElement>('#menu input');
        inputElement.onkeypress = this.onSearchKeyPress.bind(this);
        const searchButton = document.querySelector<HTMLButtonElement>('#menu button');
        searchButton.onclick = this.onSearchClick.bind(this);
    }

    initializeTorrents() {
        this.clearTorrents();
    }

    onLoginKeyPress(e: KeyboardEvent) {
        if (this.isEnterKey(e) === true) {
            this.login();
        }
    }

    onLoginClick(e: MouseEvent) {
        this.login();
    }

    onSearchKeyPress(e: KeyboardEvent) {
        if (this.isEnterKey(e) === true) {
            this.search();
        }
    }

    onSearchClick(e: MouseEvent) {
        this.search();
    }

    isEnterKey(e: KeyboardEvent) {
        return e.code === 'Enter';
    }

    showLogin() {
        this.showLoginError(false);
        this.show('login');
    }

    showLoginError(show: boolean) {
        const errorBox = document.querySelector<HTMLDivElement>('#login .error');
        this.showElement(errorBox, show);
    }
    
    async login() {
        const username = this.getInputValue('username');
        const password = this.getInputValue('password');
        const loginRequest: LoginRequest = {
            username: username,
            password: password
        };
        const loginResult = await api.login(loginRequest);
        if (loginResult.success === true) {
            this.hide('login');
            await this.showTorrents();
        }
        else {
            this.showLoginError(true);
        }
    }

    getInputValue(id: string) {
        const input = <HTMLInputElement>document.getElementById(id);
        return input.value;
    }

    search() {
        throw new Error('Not implemented.');
    }

    async showTorrents() {
        this.clearTorrents();
        this.show('menu');
        this.show('torrents');
        throw new Error('Not implemented.');
    }

    clearTorrents() {
        const torrentTable = document.querySelector<HTMLTableElement>('#torrents table');
        for (let child = torrentTable.firstChild; child != null; child = torrentTable.firstChild) {
            torrentTable.removeChild(child);
        }
    }
}