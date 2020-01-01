export interface TorrentSite {
    name: string;
    // Maps numeric category IDs to category names.
    categories: Map<number, string>;

    login(username: string, password: string);
    browse(query: string, categories: number[], page: number): BrowseResults;
    download(id: number): Buffer;
}

export class BrowseResults {
    torrents: Torrent[];
    pages: number;
}

export class Torrent {
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