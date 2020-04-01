import * as api from './api.js';
import * as common from './common.js';

export class Client {
    sites: common.Site[];

    async start() {
        this.initializeInterface();
        this.validateSession();
    }

    async validateSession() {
        const response = await api.validateSession();
        if (response.valid === true) {
            const sitesResponse = await api.getSites();
            if (sitesResponse.sites.length === 0) {
                throw new Error('Server returned no sites.');
            }
            this.sites = sitesResponse.sites;
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
        const displayStyle = element.classList.contains('flex') === true ? 'flex' : 'block';
        element.style.display = show === true ? displayStyle : 'none';
    }

    hideElement(element: HTMLElement) {
        this.showElement(element, false);
    }

    removeChildren(element: HTMLElement) {
        for (let child = element.firstChild; child != null; child = element.firstChild) {
            element.removeChild(child);
        }
    }

    initializeInterface() {
        this.initializeLogin();
        this.initializeMenu();
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
        const loginRequest: common.LoginRequest = {
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
        const torrentTable = document.querySelector<HTMLTableElement>('#torrents table');
        this.removeCells(torrentTable);
        this.show('menu');
        this.show('torrents');
        // To do: show loading indicator instead of empty table.
        const firstSite = this.sites[0];
        const browseRequest: common.BrowseRequest = {
            site: firstSite.name,
            page: 1
        };
        const browseResult = await api.browse(browseRequest);
        this.renderTorrents(browseResult.torrents, firstSite, torrentTable);
    }

    removeCells(table: HTMLTableElement) {
        const cells = table.querySelectorAll('td');
        cells.forEach(cell => {
            table.removeChild(cell);
        });
    }

    renderTorrents(torrents: common.Torrent[], site: common.Site, table: HTMLTableElement) {
        torrents.forEach(torrent => {
            const categoryName = this.getCategoryName(torrent.categoryId, site);
            const sizeString = this.getSizeString(torrent.size);
            const localeDateString = this.getLocaleDateString(torrent.added);
            const cellStrings = [
                categoryName,
                torrent.name,
                sizeString,
                torrent.downloads.toString(),
                torrent.seeders.toString(),
                torrent.leechers.toString(),
                localeDateString
            ];
            const torrentNameIndex = 1;
            const cells = cellStrings.map((cellString, i) => {
                const cell = document.createElement('td');
                if (i === torrentNameIndex) {
                    const span = document.createElement('span');
                    span.innerText = cellString;
                    cell.appendChild(span);
                }
                else {
                    cell.innerText = cellString;
                }
                return cell;
            });
            const row = document.createElement('tr');
            cells.forEach(cell => {
                row.appendChild(cell);
            });
            table.appendChild(row);
        });
    }

    getCategoryName(categoryId: number, site: common.Site) {
        const category = site.categories.find(category => category.id === categoryId);
        if (category != null) {
            return category.name;
        }
        else {
            return 'Unknown';
        }
    }

    getSizeString(bytes: number) {
        const units = [
            'KiB',
            'MiB',
            'GiB'
        ];
        let size = bytes;
        let unit: string = null;
        const base = 1024;
        for (let i = 0; i < units.length; i++) {
            unit = units[i];
            size /= base;
            if (size < base) {
                break;
            }
        }
        const sizeString = `${size.toFixed(2)} ${unit}`;
        return sizeString;
    }

    getLocaleDateString(dateString: string) {
        const date = new Date(dateString);
        const numeric = 'numeric';
        const options = {
            year: numeric,
            month: numeric,
            day: numeric,
            hour: numeric,
            minute: numeric,
            second: numeric
        };
        const localeDateString = date.toLocaleDateString(undefined, options);
        return localeDateString;
    }
}