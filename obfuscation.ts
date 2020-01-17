import crypto from 'crypto';

const algorithm = 'aes-128-cbc';
const inputEncoding = 'utf8';
const outputEncoding = 'base64';
const prefix = '\n';
const keySize = 16;
const iv = Buffer.alloc(16);

export function obfuscate(input: string): string {
    if (input == null) {
        return input;
    }
    else if (isObfuscated(input) === true) {
        return input;
    }
    const key = crypto.randomBytes(keySize);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const update = cipher.update(input, inputEncoding);
    const final = cipher.final();
    const obfuscated = Buffer.concat([key,  update, final]);
    const obfuscatedString = prefix + obfuscated.toString(outputEncoding);
    return obfuscatedString;
}

export function deobfuscate(input: string): string {
    if (input == null) {
        return input;
    }
    else if (isObfuscated(input) === false) {
        return input;
    }
    const obfuscated = Buffer.from(input, outputEncoding);
    const key = obfuscated.subarray(0, keySize);
    const encrypted = obfuscated.subarray(keySize);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const deobfuscatedString = decipher.update(encrypted, outputEncoding, inputEncoding) + decipher.final(inputEncoding);
    return deobfuscatedString;
}

export function isObfuscated(input: string): boolean {
    return input.length >= 2 && input[0] === prefix;
}