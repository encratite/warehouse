import crypto from 'crypto';

const algorithm = 'aes-128-cbc';
const inputEncoding = 'utf8';
const outputEncoding = 'base64';
const keySize = 16;
const iv = Buffer.alloc(16);

export function obfuscate(input: string | string[]): string[] {
	if (input == null) {
		return null;
	}
	else if (input instanceof Array) {
		return <string[]>input;
	}
	const key = crypto.randomBytes(keySize);
	const cipher = crypto.createCipheriv(algorithm, key, iv);
	const update = cipher.update(<string>input, inputEncoding);
	const final = cipher.final();
	const obfuscated = Buffer.concat([key,  update, final]);
	const obfuscatedString = obfuscated.toString(outputEncoding);
	const output = [ obfuscatedString ];
	return output;
}

export function deobfuscate(input: string | string[]): string {
	if (input == null) {
		return null;
	}
	else if (typeof input === 'string') {
		return <string>input;
	}
	const obfuscated = Buffer.from(input[0], outputEncoding);
	const key = obfuscated.subarray(0, keySize);
	const encrypted = obfuscated.subarray(keySize);
	const decipher = crypto.createDecipheriv(algorithm, key, iv);
	const deobfuscatedString = decipher.update(encrypted, outputEncoding, inputEncoding) + decipher.final(inputEncoding);
	return deobfuscatedString;
}