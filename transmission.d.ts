declare function Transmission(options: TransmissionOptions): TransmissionClient;

interface TransmissionOptions {
    host: string;
    port: number;
    username: string;
    password: string;
    ssl: boolean;
    url: string;
}

interface TransmissionClient {
    statusArray: string[];
    status: TransmissionStatus;
    
    set(ids, options, callback);
    add(path, options, callback);
    addFile(filePath, options, callback);
    addBase64(fileb64, options, callback);
    addUrl(url, options, callback);
    addTorrentDataSrc(args, options, callback);
    remove(ids, del, callback);
    move(ids, location, move, callback);
    rename(ids, path, name, callback);
    get(ids, callback);
    waitForState(id, targetState, callback);
    peers(ids, callback);
    files(ids, callback);
    fast(ids, callback);
    stop(ids, callback);
    stopAll(callback);
    start(ids, callback);
    startAll(callback);
    startNow(ids, callback);
    verify(ids, callback);
    reannounce(ids, callback);
    all(callback);
    active(callback);
    session(data, callback);
    sessionStats(callback);
    freeSpace(path, callback);
    callServer(query, callBack);

}

interface TransmissionStatus {
    STOPPED: number;
    CHECK_WAIT: number;
    CHECK: number;
    DOWNLOAD_WAIT: number;
    DOWNLOAD: number;
    SEED_WAIT: number;
    SEED: number;
    ISOLATED: number;
}

export = Transmission;