import { Site } from './configuration.js';
import { Torrent } from './common.js';

export interface TorrentSite {
	name: string;
	// Maps numeric category IDs to category names.
	categories: Map<number, string>;

	initialize(settings: Site);
	login();
	browse(page: number): Promise<BrowseResults>;
	search(query: string, categories: number[], page: number): Promise<BrowseResults>;
	download(id: number): Promise<Buffer>;
	getInfo(id: number): Promise<TorrentInfo>;
}

export interface BrowseResults {
	torrents: Torrent[];
	pages: number;
}

export interface TorrentInfo {
	name: string;
	// Approximate size of the release, in bytes.
	size: number;
	seeders: number;
	leechers: number;
	downloads: number;
}