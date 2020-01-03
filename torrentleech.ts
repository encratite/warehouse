import request from 'request';

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
    static readonly headers: request.Headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'
    };

    name: string = 'torrentleech.org';
    categories: Map<number, string> = new Map<number, string>([
        [8, 'Cam'],
        [9, 'TS/TC'],
        [11, 'DVDRip/DVDScreener'],
        [37, 'WEBRip'],
        [43, 'HDRip'],
        [14, 'BlurayRip'],
        [12, 'DVD-R'],
        [13, 'Bluray'],
        [47, '4K'],
        [15, 'Boxsets'],
        [29, 'Documentaries'],
        [26, 'Episodes'],
        [32, 'Episodes HD'],
        [27, 'Boxsets'],
        [17, 'PC'],
        [42, 'Mac'],
        [18, 'XBOX'],
        [19, 'XBOX360'],
        [40, 'XBOXONE'],
        [20, 'PS2'],
        [21, 'PS3'],
        [39, 'PS4'],
        [22, 'PSP'],
        [28, 'Wii'],
        [30, 'Nintendo DS'],
        [48, 'Nintendo Switch'],
        [23, 'PC-ISO'],
        [24, 'Mac'],
        [25, 'Mobile'],
        [33, '0-day'],
        [34, 'Anime'],
        [35, 'Cartoons'],
        [45, 'EBooks'],
        [46, 'Comics'],
        [31, 'Audio'],
        [16, 'Music videos'],
        [36, 'Movies'],
        [44, 'TV Series']
    ]);

    username: string;
    password: string;
    loggedIn: boolean = false;

    initialize(settings: Site) {
        this.username = settings.username;
        this.password = settings.password;
    }

    async login() {
        // Get the cookie jar started.
        await request.get({
            url: 'https://www.torrentleech.org/',
            jar: true,
            headers: TorrentLeech.headers
        });
        // Perform the actual login.
        const loginRequest = await request.post({
            url: 'https://www.torrentleech.org/user/account/login/',
            jar: true,
            headers: TorrentLeech.headers,
            form: {
                username: this.username,
                password: this.password
            }
        });
        const body = <string>loginRequest.body;
        this.loggedIn = body.includes('PVPNIPAddress');
        if (this.loggedIn === false) {
            throw new Error('Failed to log in.');
        }
    }

    async browse(query: string, categories: number[], page: number): Promise<site.BrowseResults> {
        if (this.loggedIn === false) {
            await this.login();
        }
        let url = 'https://www.torrentleech.org/torrents/browse/list';
        if (categories.length > 0) {
            url += '/categories/' + categories.join(',');
        }
        url += '/query/' + encodeURIComponent(query);
        if (page >= 2) {
            url += '/page/' + page;
        }
        const browseRequest = await request.get({
            url: url,
            jar: true,
            headers: TorrentLeech.headers
        });
        if (browseRequest.response.statusCode !== 200) {
            throw new Error('Failed to browse torrents. Check query parameters.');
        }
        const body = <string>browseRequest.body;
        const torrentList: JsonTorrentList = JSON.parse(body);
        const torrents: common.Torrent[] = torrentList.torrentList.map(this.convertTorrent.bind(this));
        const pages = Math.ceil(torrentList.numFound / torrentList.perPage);
        const browseResults: site.BrowseResults = {
            torrents: torrents,
            pages: pages
        };
        return browseResults;
    }

    async download(id: number): Promise<Buffer> {
        throw new Error('Not implemented.');
    }

    convertTorrent(jsonTorrent: JsonTorrent): common.Torrent {
        const id = parseInt(jsonTorrent.fid);
        const added = this.getDateFromString(jsonTorrent.addedTimestamp);
        const torrent: common.Torrent = {
            id: id,
            name: jsonTorrent.name,
            categoryId: jsonTorrent.categoryID,
            added: added,
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
}