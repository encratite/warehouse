import request from 'request-promise';

import { Site } from './configuration.js';
import * as site from './site.js';
import * as common from './common.js';

interface JsonTorrentList {
	numFound: number;
	torrentList: JsonTorrent[];
	facets: JsonFacets;
	order: string;
	orderBy: string;
	page: number;
	perPage: number;
	lastBrowseTime: string;
	userTimeZone: string;
}

interface JsonTorrent {
	fid: string;
	filename: string;
	name: string;
	addedTimestamp: string;
	categoryID: number;
	size: number;
	completed: number;
	seeders: number;
	leechers: number;
	numComments: number;
	tags: string | string[];
	new: boolean;
	imdbID: string;
	rating: number;
	genres: string;
	tvmazeID: string;
	igdbID: string;
	download_multiplier: number;
}

interface JsonFacets {
	tags: any;
	size: any;
	added: any;
	seeders: any;
	name: any;
	facetswoc: any;
}

export class TorrentLeech implements site.TorrentSite {
	// Imitate a current version of Chrome for Windows.
	static readonly headers: any = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'
	};

	name: string = 'torrentleech.org';
	categories: common.Category[] = [
		{ id: 8, name: 'Cam' },
		{ id: 9, name: 'TS/TC' },
		{ id: 11, name: 'DVDRip/DVDScreener' },
		{ id: 37, name: 'WEBRip' },
		{ id: 43, name: 'HDRip' },
		{ id: 14, name: 'BlurayRip' },
		{ id: 12, name: 'DVD-R' },
		{ id: 13, name: 'Bluray' },
		{ id: 47, name: '4K' },
		{ id: 15, name: 'Boxsets' },
		{ id: 29, name: 'Documentaries' },
		{ id: 26, name: 'Episodes' },
		{ id: 32, name: 'Episodes HD' },
		{ id: 27, name: 'Boxsets' },
		{ id: 17, name: 'PC' },
		{ id: 42, name: 'Mac' },
		{ id: 18, name: 'XBOX' },
		{ id: 19, name: 'XBOX360' },
		{ id: 40, name: 'XBOXONE' },
		{ id: 20, name: 'PS2' },
		{ id: 21, name: 'PS3' },
		{ id: 39, name: 'PS4' },
		{ id: 22, name: 'PSP' },
		{ id: 28, name: 'Wii' },
		{ id: 30, name: 'Nintendo DS' },
		{ id: 48, name: 'Nintendo Switch' },
		{ id: 23, name: 'PC-ISO' },
		{ id: 24, name: 'Mac' },
		{ id: 25, name: 'Mobile' },
		{ id: 33, name: '0-day' },
		{ id: 34, name: 'Anime' },
		{ id: 35, name: 'Cartoons' },
		{ id: 45, name: 'EBooks' },
		{ id: 46, name: 'Comics' },
		{ id: 31, name: 'Audio' },
		{ id: 16, name: 'Music videos' },
		{ id: 36, name: 'Movies' },
		{ id: 44, name: 'TV Series' }
	];

	username: string;
	password: string;
	loggedIn: boolean = false;
	request: any;

	initialize(settings: Site) {
		this.username = <string>settings.username;
		this.password = <string>settings.password;
		this.request = request.defaults({
			jar: true,
			headers: TorrentLeech.headers,
			transform: this.transform.bind(this),
			simple: false
		});
	}

	transform(body, response, resolveWithFullResponse) {
		return response;
	}

	async login() {
		const response = await this.request({
			method: 'POST',
			url: 'https://www.torrentleech.org/user/account/login/',
			form: {
				username: this.username,
				password: this.password
			}
		});
		if (response.statusCode !== 302) {
			throw new Error('Unexpected login status code.');
		}
		if (response.headers.location !== '/') {
			throw new Error('Unexpected login location header.');
		}
		this.loggedIn = true;
	}

	async browse(page: number): Promise<site.BrowseResults> {
		const baseUrl = 'https://www.torrentleech.org/torrents/browse/list';
		const results = this.getBrowseResults(baseUrl, null, null, page);
		return results;
	}

	async search(query: string, categories: number[], page: number): Promise<site.BrowseResults> {
		const baseUrl = 'https://www.torrentleech.org/torrents/browse/list';
		const browseResults = this.getBrowseResults(baseUrl, query, categories, page);
		return browseResults;
	}

	async download(id: number): Promise<Buffer> {
		await this.loginCheck();
		const response = await this.request({
			url: `https://www.torrentleech.org/download/${id}/${id}.torrent`,
			encoding: null
		});
		if (response.statusCode !== 200) {
			throw new Error('Failed to download torrent file.');
		}
		if (response.headers['content-type'] !== 'application/x-bittorrent') {
			throw new Error('Unexpected MIME type.');
		}
		return response.body;
	}

	async getInfo(id: number): Promise<site.TorrentInfo> {
		await this.loginCheck();
		const response = await this.request({
			url: `https://www.torrentleech.org/torrent/${id}`
		});
		if (response.statusCode !== 200) {
			this.loggedIn = false;
			throw new Error('Failed to retrieve torrents. Check query parameters.');
		}
		const name = this.extract('name', /<a .+? href="\/download\/\d+\/(.+?)\.torrent">/, response);
		const sizeTokens = this.extractAll('size', /<td class="description">Size<\/td><td>([0-9.]+) (KB|MB|GB|TB)<\/td>/, response);
		const size = this.parseSize(sizeTokens);
		const seeders = parseInt(this.extract('seeders', /<span class="seeders-text">(\d+)\s*<\/span>/, response));
		const leechers = parseInt(this.extract('leechers', /<span class="leechers-text">(\d+)<\/span>/, response));
		const downloads = parseInt(this.extract('downloads', /<td class="description">Downloaded<\/td><td>(\d+).+?<\/td>/, response));
		const torrentInfo: site.TorrentInfo = {
			name: name,
			size: size,
			seeders: seeders,
			leechers: leechers,
			downloads: downloads
		};
		return torrentInfo;
	}

	convertTorrent(jsonTorrent: JsonTorrent): common.Torrent {
		const id = parseInt(jsonTorrent.fid);
		const torrent: common.Torrent = {
			id: id,
			name: jsonTorrent.name,
			categoryId: jsonTorrent.categoryID,
			added: jsonTorrent.addedTimestamp,
			// Size of release, in bytes.
			size: jsonTorrent.size,
			downloads: jsonTorrent.completed,
			seeders: jsonTorrent.seeders,
			leechers: jsonTorrent.leechers
		};
		return torrent;
	}

	getDateFromString(dateString: string): Date {
		const pattern = /(\d+-\d+-\d+) (\d+:\d+:\d+)/;
		const match = pattern.exec(dateString);
		if (match == null) {
			return null;
		}
		const utcDateString = `${match[1]}T${match[2]}Z`;
		const date = new Date(utcDateString);
		return date;
	}

	async loginCheck() {
		if (!this.loggedIn) {
			await this.login();
		}
	}

	async getBrowseResults(baseUrl: string, query: string, categories: number[], page: number): Promise<site.BrowseResults> {
		await this.loginCheck();
		const url = this.getBrowseUrl(baseUrl, query, categories, page);
		const response = await this.request({
			url: url
		});
		if (response.statusCode !== 200) {
			this.loggedIn = false;
			throw new Error('Failed to retrieve torrents. Check query parameters.');
		}
		const torrentList: JsonTorrentList = JSON.parse(response.body);
		const torrents: common.Torrent[] = torrentList.torrentList.map(this.convertTorrent.bind(this));
		const pages = Math.ceil(torrentList.numFound / torrentList.perPage);
		const browseResults: site.BrowseResults = {
			torrents: torrents,
			pages: pages
		};
		return browseResults;
	}

	getBrowseUrl(baseUrl: string, query: string, categories: number[], page: number): string {
		let url = baseUrl;
		if (categories != null && categories.length > 0) {
			url += `/categories/${categories.join(',')}`;
		}
		if (query != null) {
			url += `/query/${encodeURIComponent(query)}`;
		}
		if (page >= 2) {
			url += `/page/${page}`;
		}
		return url;
	}

	extractAll(name: string, pattern: RegExp, response: any) {
		const match = pattern.exec(response.body);
		if (match == null) {
			throw new Error(`Failed to extract parameter "${name}".`);
		}
		return match;
	}

	extract(name: string, pattern: RegExp, response: any) {
		const match = this.extractAll(name, pattern, response);
		return match[1];
	}

	parseSize(sizeTokens: RegExpExecArray) {
		const size = parseFloat(sizeTokens[1]);
		const sizeUnit = sizeTokens[2];
		const units = [
			'KB',
			'MB',
			'GB',
			'TB'
		];
		const index = units.findIndex(value => value === sizeUnit);
		if (index === -1) {
			throw new Error('Unknown size unit.');
		}
		const sizeBytes = Math.pow(1024, index + 1) * size;
		return sizeBytes;
	}
}