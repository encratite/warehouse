import * as api from './api.js';
import * as common from './common.js';
import { SiteTorrent } from './sitetorrent.js';

export class Client {
	sites: common.Site[];
	currentPage: number;
	sitePageCounts: Map<common.Site, number> = new Map();
	pagingHandler: (page: number) => Promise<void>;

	async start() {
		this.initializeInterface();
		this.validateSession();
	}

	async validateSession() {
		const response = await api.validateSession();
		if (response.valid === true) {
			await this.getSites();
			await this.browseTorrents();
		}
		else {
			this.showLogin();
		}
	}

	async getSites() {
		const sitesResponse = await api.getSites();
		if (sitesResponse.sites.length === 0) {
			throw new Error('Server returned no sites.');
		}
		this.sites = sitesResponse.sites;
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

	notImplemented() {
		throw new Error('Not implemented.');
	}

	initializeInterface() {
		this.initializeLogin();
		this.initializeMenu();
		this.initializeTorrents();
	}

	initializeLogin() {
		const container = document.querySelector<HTMLDivElement>('#login');
		const inputElements = container.querySelectorAll('input');
		inputElements.forEach((element: HTMLInputElement) => {
			element.onkeypress = this.onLoginKeyPress.bind(this);
		});
		const loginButton = container.querySelector<HTMLButtonElement>('button');
		loginButton.onclick = this.onLoginClick.bind(this);
	}

	initializeMenu() {
		const container = document.querySelector<HTMLDivElement>('#menu');
		const inputElement = container.querySelector<HTMLInputElement>('input');
		inputElement.onkeypress = this.onSearchKeyPress.bind(this);
		const searchButton = container.querySelector<HTMLButtonElement>('button');
		searchButton.onclick = this.onSearchClick.bind(this);

		this.setClickHandler('browseLink', this.onBrowseLinkClick.bind(this));
		this.setClickHandler('subscriptionsLink', this.onSubscriptionsLinkClick.bind(this));
		this.setClickHandler('statusLink', this.onStatusLinkClick.bind(this));
		this.setClickHandler('profileLink', this.onProfileLinkClick.bind(this));
	}

	setClickHandler(id: string, onClick: (ev: MouseEvent) => void) {
		const element = document.getElementById(id);
		element.onclick = onClick;
	}

	initializeTorrents() {
		const container = document.querySelector<HTMLDivElement>('#torrents');
		const pageMenuButtons = container.querySelectorAll('.pageMenu i');
		const previousPageButton = <HTMLElement>pageMenuButtons[0];
		const nextPageButton = <HTMLElement>pageMenuButtons[1];
		previousPageButton.onclick = this.onPreviousPageClick.bind(this);
		nextPageButton.onclick = this.onNextPageClick.bind(this);
	}

	async setBusy(action: () => Promise<void>) {
		const overlay = document.querySelector<HTMLDivElement>('#overlay');
		const buttons = document.querySelectorAll<HTMLInputElement>('input[type="button"]');
		const setOverlayDisplay = (display: string) => {
			overlay.style.display = display;
		};
		const disableButtons = (disable: boolean) => {
			buttons.forEach(button => {
				button.disabled = disable;
			});
		};
		setOverlayDisplay('block');
		disableButtons(true);
		try {
			await action();
		}
		catch (error) {
			throw error;
		}
		finally {
			setOverlayDisplay('none');
			disableButtons(false);
		}
	}

	async onLoginKeyPress(e: KeyboardEvent) {
		if (this.isEnterKey(e) === true) {
			await this.login();
		}
	}

	async onLoginClick(e: MouseEvent) {
		await this.login();
	}

	async onBrowseLinkClick(e: MouseEvent) {
		await this.browseTorrents();
	}

	async onSubscriptionsLinkClick(e: MouseEvent) {
		this.notImplemented();
	}

	async onStatusLinkClick(e: MouseEvent) {
		this.notImplemented();
	}

	async onProfileLinkClick(e: MouseEvent) {
		this.notImplemented();
	}

	async onSearchKeyPress(e: KeyboardEvent) {
		if (this.isEnterKey(e) === true) {
			await this.searchTorrents();
		}
	}

	async onSearchClick(e: MouseEvent) {
		await this.searchTorrents();
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
		await this.setBusy(async () => {
			const username = this.getInputValue('username');
			const password = this.getInputValue('password');
			const loginRequest: common.LoginRequest = {
				username: username,
				password: password
			};
			const loginResult = await api.login(loginRequest);
			if (loginResult.success === true) {
				await this.getSites();
				await this.browseTorrents();
				this.hide('login');
			}
			else {
				this.showLoginError(true);
			}
		});
	}

	getInputValue(id: string) {
		const input = <HTMLInputElement>document.getElementById(id);
		return input.value;
	}

	async searchTorrents() {
		let query =  this.getInputValue('search');
		query = query.trim();
		if (query.length === 0) {
			return;
		}
		this.sitePageCounts.clear();
		await this.search(query, 1);
		this.showContainer('torrents');
	}

	async browseTorrents() {
		this.sitePageCounts.clear();
		await this.browse(1);
		this.showContainer('torrents');
	}

	showContainer(id: string) {
		this.hideContainers();
		this.show(id);
	}

	hideContainers(showMenu: boolean = true) {
		const containers = document.querySelectorAll<HTMLDivElement>('body > div:nth-child(n + 2)');
		containers.forEach(container => {
			this.hideElement(container);
		});
		this.show('menu');
	}

	clearTable(table: HTMLTableElement) {
		const body = table.querySelector('tbody');
		const cells = body.querySelectorAll('tr:nth-child(n + 2)');
		cells.forEach(cell => {
			body.removeChild(cell);
		});
	}

	async browse(page: number) {
		this.pagingHandler = page => this.browse(page);
		await this.browseOrSearch(page, site => {
			const browsingRequest = {
				site: site.name,
				page: page
			};
			const promise = api.browse(browsingRequest);
			return promise;
		});
	}

	async search(query: string, page: number) {
		this.pagingHandler = page => this.search(query, page);
		await this.browseOrSearch(page, site => {
			const searchRequest = {
				site: site.name,
				query: query,
				categories: null,
				page: page
			};
			const promise = api.search(searchRequest);
			return promise;
		});
	}

	async browseOrSearch(page: number, operation: (site: common.Site) => Promise<common.BrowseResponse>) {
		await this.setBusy(async () => {
			this.currentPage = page;
			let promises: Promise<common.BrowseResponse>[] = [];
			this.sites.forEach(site => {
				const sitePageCount = this.sitePageCounts.get(site);
				if (sitePageCount == null || page <= sitePageCount) {
					const promise = operation(site);
					promises.push(promise);
				}
			});
			const browseResults = await Promise.all(promises);
			this.renderTorrents(browseResults);
		});
	}

	renderTorrents(browseResults: common.BrowseResponse[]) {
		const siteTorrents = this.getSiteTorrents(browseResults);
		const torrentContainer = document.querySelector<HTMLDivElement>('#torrents');
		const torrentTable = torrentContainer.querySelector<HTMLTableElement>('table');
		this.clearTable(torrentTable);
		this.renderTorrentTable(siteTorrents, torrentTable);
		this.renderPageCount(torrentContainer);
	}

	getSiteTorrents(browseResults: common.BrowseResponse[]): SiteTorrent[] {
		let siteTorrents: SiteTorrent[] = [];
		browseResults.forEach((browseResult,  index) => {
			const site = this.sites[index];
			this.sitePageCounts.set(site, browseResult.pages);
			const newSiteTorrents = browseResult.torrents.map(torrent => new SiteTorrent(site, torrent));
			siteTorrents = siteTorrents.concat(newSiteTorrents);
		});
		this.sortTorrentsByTime(siteTorrents);
		return siteTorrents;
	}

	sortTorrentsByTime(siteTorrents: SiteTorrent[]) {
		siteTorrents.sort((torrent1, torrent2) => {
			const date1 = new Date(torrent1.torrent.added);
			const date2 = new Date(torrent2.torrent.added);
			const difference = date2.getTime() - date1.getTime();
			return difference;
		});
	}

	renderTorrentTable(siteTorrents: SiteTorrent[], table: HTMLTableElement) {
		const body = <HTMLElement>table.querySelector('tbody');
		siteTorrents.forEach(siteTorrent => {
			const torrent = siteTorrent.torrent;
			const categoryName = this.getCategoryName(torrent.categoryId, siteTorrent.site);
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
					span.onclick = this.onTorrentClick.bind(this);
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
			body.appendChild(row);
		});
	}

	renderPageCount(torrentContainer: HTMLDivElement) {
		const lastPage = this.getLastPage();
		const pageMenu = torrentContainer.querySelector<HTMLDivElement>('.pageMenu');
		const pageCount = pageMenu.querySelector<HTMLLIElement>('li:nth-child(2)');
		pageCount.textContent = `Page ${this.currentPage} of ${lastPage}`;
		const showMenu = lastPage > 1;
		this.showElement(pageMenu, showMenu);
	}

	async onTorrentClick(ev: MouseEvent) {
		this.notImplemented();
	}

	async onPreviousPageClick(ev: MouseEvent) {
		await this.showNextPage(true);
	}

	async onNextPageClick(ev: MouseEvent) {
		await this.showNextPage(false);
	}

	async showNextPage(reverse: boolean) {
		const direction = reverse === false ? 1 : -1;
		const nextPage = this.currentPage + direction;
		const lastPage = this.getLastPage();
		if (nextPage >= 1 && nextPage <= lastPage) {
			await this.pagingHandler(nextPage);
			window.scrollTo(0, 0);
		}
	}

	getLastPage(): number {
		let lastPage: number = null;
		for (let pages of this.sitePageCounts.values()) {
			if (lastPage == null || pages > lastPage) {
				lastPage = pages;
			}
		}
		return lastPage;
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