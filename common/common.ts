export const route = {
	login: '/login',
	logout: '/logout',
	validateSession: '/validate-session',
	search: '/search',
	download: '/download',
	getTorrents: '/get-torrents',
	getSubscriptions: '/get-subscriptions',
	createSubscription: '/create-subscription',
	deleteSubscription: '/delete-subscription'
};

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

export interface SearchRequest {
	site: string;
	query: string;
	categories: number[];
	page: number;
}

export interface SearchResponse {
	torrents: Torrent[];
	pages: number;
}

export interface DownloadRequest {
	site: string;
	id: number;
}

export interface GetTorrentResponse {
	torrents: TorrentState[];
}

export interface GetSubscriptionRequest {
	// Retrieve all subscriptions rather than just those of a single user.
	// May only be used by administrators.
	all: boolean;
	// Retrieve the subscriptions of the user matching this particular ID.
	// Only used when getAll === false.
	// May only be used by administrators.
	userId: string;
}

export interface GetSubscriptionResponse {
	subscriptions: Subscription[];
}

export interface CreateSubscriptionRequest {
	pattern: string;
	category: string;
}

export interface CreateSubscriptionResponse {
	subscriptionId: string;
}

export interface DeleteSubscriptionRequest {
	subscriptionId: string;
}

export interface Torrent {
	id: number;
	name: string;
	categoryId: number;
	// The time the torrent was added, as an ISO date string.
	added: string;
	// Size of release, in bytes.
	size: number;
	downloads: number;
	seeders: number;
	leechers: number;
}

export interface TorrentState {
	name: string;
	// Download speed, in bytes per second.
	downloadSpeed: number;
	// Upload speed, in bytes per second.
	uploadSpeed: number;
	// Number of peers.
	peers: number;
	// Size of release, in bytes.
	size: number;
	// Corresponds to the Transmission "status" field, which is really an enum of type transmission.TorrentState.
	state: number;
	// The time the torrent was added to Transmission, as an ISO date string.
	added: string;
}

export interface Subscription {
	pattern: string;
	category: string;
	matches: number;
	// The time the subscription was created, as an ISO date string.
	created: string;
	// The last time the subscription caused a torrent to be queued, as an ISO date string.
	lastMatch: string;
}