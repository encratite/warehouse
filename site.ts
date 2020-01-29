import { Site } from './configuration.js';
import { Torrent } from './common.js';

export interface TorrentSite {
	name: string;
	// Maps numeric category IDs to category names.
	categories: Map<number, string>;

	initialize(settings: Site);
	login();
	search(query: string, categories: number[], page: number): Promise<BrowseResults>;
	download(id: number): Promise<Buffer>;
}

export interface BrowseResults {
	torrents: Torrent[];
	pages: number;
}