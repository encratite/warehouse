import request from 'request';

import { Site } from './configuration.js';
import * as site from './site.js';

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
            },
        });
        this.loggedIn = true;
    }

    async browse(query: string, categories: number[], page: number): Promise<site.BrowseResults> {
        if (this.loggedIn === false) {
            await this.login();
        }
        throw new Error('Not implemented.');
    }

    async download(id: number): Promise<Buffer> {
        throw new Error('Not implemented.');
    }
}