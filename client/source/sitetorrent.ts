import * as common from './common.js';

export class SiteTorrent {
    site: common.Site;
    torrent: common.Torrent;

    constructor(site: common.Site, torrent: common.Torrent) {
        this.site = site;
        this.torrent = torrent;
    }
}