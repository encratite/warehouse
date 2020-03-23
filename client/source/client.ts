import * as api from './api.js';

export class Client {
    async start() {
        this.initializeInterface();
        this.validateSession();
    }

    async validateSession() {
        const response = await api.validateSession();
        if (response.valid === true) {
            this.show('menu');
            this.show('torrents');
        }
        else {
            this.show('login');
        }
    }

    show(id: string) {
        const element = document.getElementById(id);
        element.style.display = 'block';
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
        const loginButton = <HTMLButtonElement>document.querySelector('#login button');
        loginButton.onclick = this.onLoginClick.bind(this);
    }

    initializeMenu() {
        const inputElement = <HTMLInputElement>document.querySelector('#menu input');
        inputElement.onkeypress = this.onSearchKeyPress.bind(this);
        const searchButton = <HTMLButtonElement>document.querySelector('#menu button');
        searchButton.onclick = this.onSearchClick.bind(this);
    }

    initializeTorrents() {
        const torrentTable = <HTMLTableElement>document.querySelector('#torrents table');
        for (let child = torrentTable.firstChild; child != null; child = torrentTable.firstChild) {
            torrentTable.removeChild(child);
        }
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
    
    login() {
        throw new Error('Not implemented.');
    }

    search() {
        throw new Error('Not implemented.');
    }
}