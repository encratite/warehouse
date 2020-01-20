export interface ErrorResponse {
	error: string;
}

export interface LoginRequest {
	username: string;
	password: string;
}

export interface LoginResponse {
	success: boolean;
}

export interface ValidateSessionResponse {
	valid: boolean;
}

export interface BrowseRequest {
	site: string;
	query: string;
	categories: number[];
	page: number;
}

export interface BrowseResponse {
	torrents: Torrent[];
	pages: number;
}

export interface DownloadRequest {
	site: string;
	id: number;
}

export interface Torrent {
	id: number;
	name: string;
	categoryId: number;
	added: Date;
	// Size of release, in bytes.
	size: number;
	downloads: number;
	seeders: number;
	leechers: number;
}