declare function check(path: string): Promise<DiskSpaceInfo>;

declare interface DiskSpaceInfo {
    diskPath: string;
    free: number;
    size: number;
}

export = check;