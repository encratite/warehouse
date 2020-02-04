declare function check(path: string): DiskSpace;

declare interface DiskSpace {
    diskPath: string;
    free: number;
    size: number;
}

export = check;