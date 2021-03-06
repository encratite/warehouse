declare function t(options: t.TransmissionOptions): t.TransmissionClient;

declare namespace t {
	enum TorrentState {
		STOPPED = 0,
		CHECK_WAIT,
		CHECK,
		DOWNLOAD_WAIT,
		DOWNLOAD,
		SEED_WAIT,
		SEED,
		ISOLATED
	}

	interface TransmissionOptions {
		host: string;
		port: number;
		username: string | string[];
		password: string | string[];
		ssl: boolean;
		url: string;
	}

	interface TransmissionClient {
		statusArray: string[];
		status: Object;
		
		set(ids: number[], options: Object, callback: (error: Error) => void): void;
		add(path: string, options: Object, callback: (error: Error, torrent: Torrent) => void): void;
		addFile(filePath: string, options: Object, callback: (error: Error, torrent: Torrent) => void): void;
		addBase64(fileb64: string, options: Object, callback: (error: Error, torrent: Torrent) => void): void;
		addUrl(url: string, options: Object, callback: (error: Error, torrent: Torrent) => void): void;
		addTorrentDataSrc(args: Object, options: Object, callback: (error: Error, torrent: Torrent) => void): void;
		remove(ids: number[], del: boolean, callback: (error: Error) => void): void;
		move(ids: number[], location: string, move: boolean, callback: (error: Error) => void): void;
		rename(ids: number[], path: string, name: string, callback: (error: Error, response: RenameTorrentResponse) => void): void;
		get(callback: (error: Error, response: GetTorrentResponse) => void): void;
		get(ids: number[], callback: (error: Error, response: GetTorrentResponse) => void): void;
		waitForState(id: number, targetState: TorrentState, callback: (error: Error, arguments: Object) => void): void;
		peers(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		files(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		fast(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		stop(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		stopAll(callback: (error: Error, arguments: Object) => void): void;
		start(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		startAll(callback: (error: Error, arguments: Object) => void): void;
		startNow(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		verify(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		reannounce(ids: number[], callback: (error: Error, arguments: Object) => void): void;
		all(callback: (error: Error, arguments: Object) => void): void;
		active(callback: (error: Error, arguments: Object) => void): void;
		session(data: Object, callback: (error: Error, arguments: Object) => void): void;
		sessionStats(callback: (error: Error, response: SessionStatsResponse) => void): void;
		freeSpace(path: string, callback: (error: Error, response: FreeSpaceResponse) => void): void;
		callServer(query: Object, callback: (error: Error, arguments: Object) => void): void;
	}

	interface GetTorrentResponse {
		torrents: Torrent[];
		removed: number[];
	}

	interface Torrent {
		activityDate: number;
		addedDate: number;
		bandwidthPriority: number;
		comment: string;
		corruptEver: number;
		creator: string;
		dateCreated: number;
		desiredAvailable: number;
		doneDate: number;
		downloadDir: string;
		downloadedEver: number;
		downloadLimit: number;
		downloadLimited: boolean;
		editDate: number;
		error: number;
		errorString: string;
		eta: number;
		etaIdle: number;
		files: TorrentFile[];
		fileStats: TorrentFileStats[];
		hashString: string;
		haveUnchecked: number;
		haveValid: number;
		honorsSessionLimits: boolean;
		id: number;
		isFinished: boolean;
		isPrivate: boolean;
		isStalled: boolean;
		labels: string[];
		leftUntilDone: number;
		magnetLink: string;
		manualAnnounceTime: number;
		maxConnectedPeers: number;
		metadataPercentComplete: number;
		name: string;
		// Spec says "peer-limit."
		peerLimit: number;
		peers: TorrentPeer[];
		peersConnected: number;
		peersFrom: object;
		peersGettingFromUs: number;
		peersSendingToUs: number;
		percentDone: number;
		pieces: string;
		pieceCount: number;
		pieceSize: number;
		priorities: any[];
		queuePosition: number;
		// Bytes per second.
		rateDownload: number;
		// Bytes per second.
		rateUpload: number;
		recheckProgress: number;
		secondsDownloading: number;
		secondsSeeding: number;
		seedIdleLimit: number;
		seedIdleMode: number;
		seedRatioLimit: number;
		seedRatioMode: number;
		sizeWhenDone: number;
		startDate: number;
		status: number;
		trackers: TorrentTracker[];
		trackerStats: TorrentTrackerStats[];
		totalSize: number;
		torrentFile: string;
		uploadedEver: number;
		uploadLimit: number;
		uploadLimited: boolean;
		uploadRatio: number;
		wanted: boolean[];
		webseeds: string[];
		webseedsSendingToUs: number;
	}

	interface TorrentFile {
		bytesCompleted: number;
		length: number;
		name: string;
	}

	interface TorrentFileStats {
		bytesCompleted: number;
		wanted: boolean;
		priority: number;
	}

	interface TorrentPeer {
		address: string;
		clientName: string;
		clientIsChoked: boolean;
		clientIsInterested: boolean;
		flagStr: string;
		isDownloadingFrom: boolean;
		isEncrypted: boolean;
		isIncoming: boolean;
		isUploadingTo: boolean;
		isUTP: boolean;
		peerIsChoked: boolean;
		peerIsInterested: boolean;
		port: number;
		progress: number;
		// Bytes per second.
		rateToClient: number;
		// Bytes per second.
		rateToPeer: number;
	}

	interface TorrentTracker {
		announce: string;
		id: number;
		scrape: string;
		tier: number;
	}

	interface TorrentTrackerStats {
		announce: string;
		announceState: number;
		downloadCount: number;
		hasAnnounced: boolean;
		hasScraped: boolean;
		host: string;
		id: number;
		isBackup: boolean;
		lastAnnouncePeerCount: number;
		lastAnnounceResult: string;
		lastAnnounceStartTime: number;
		lastAnnounceSucceeded: boolean;
		lastAnnounceTime: number;
		lastAnnounceTimedOut: boolean;
		lastScrapeResult: string;
		lastScrapeStartTime: number;
		lastScrapeSucceeded: boolean;
		lastScrapeTime: number;
		lastScrapeTimedOut: boolean;
		leecherCount: number;
		nextAnnounceTime: number;
		nextScrapeTime: number;
		scrape: string;
		scrapeState: number;
		seederCount: number;
		tier: number;
	}

	interface RenameTorrentResponse {
		path: string;
		name: string;
		id: number;
	}

	interface SessionStatsResponse {
		activeTorrentCount: number;
		downloadSpeed: number;
		pausedTorrentCount: number;
		torrentCount: number;
		uploadSpeed: number;
		// Spec says "cumulative-stats".
		cumulativeStats: Stats;
		// Spec says "current-stats".
		currentStats: Stats;
	}

	interface Stats {
		uploadedBytes: number;
		downloadedBytes: number;
		filesAdded: number;
		sessionCount: number;
		secondsActive: number;
	}

	interface FreeSpaceResponse {
		path: string;
		// Spec says "size-bytes".
		sizeBytes: number;
	}
}

export = t;