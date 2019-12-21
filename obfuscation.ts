import crypto from 'crypto';

const algorithm = 'aes-128-cbc';
const inputEncoding = 'utf8';
const outputEncoding = 'base64';
const separator = '$';
const iv = Buffer.alloc(16);

export function obfuscate(input: string): string {
    const key = crypto.randomBytes(16);
    const keyString = key.toString(outputEncoding);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedString = cipher.update(input, inputEncoding, outputEncoding) + cipher.final(outputEncoding);
    const obfuscatedString = keyString + separator + encryptedString;
    return obfuscatedString;
}

export function deobfuscate(input: string): string {
    const tokens = input.split(separator);
    if (tokens.length !== 2) {
        throw new Error('Invalid token count in obfuscated string.');
    }
    const keyString = tokens[0];
    const encryptedString = tokens[1];
    const key = Buffer.from(keyString, outputEncoding);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const deobfuscatedString = decipher.update(encryptedString, outputEncoding, inputEncoding) + decipher.final(inputEncoding);
    return deobfuscatedString;
}