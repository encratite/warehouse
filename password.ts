export function generatePassword(): string {
	const characters = getPasswordCharacters();
	let password = '';
	for (var i = 0; i < 32; i++) {
		const index = Math.floor(Math.random() * characters.length);
		password += characters.substring(index, index + 1);
	}
	return password;
}

function getPasswordCharacters(): string {
	const pattern = /[A-Za-z0-9]/;
	let characters = '';
	for (let i = 0; i < 256; i++) {
		const character = String.fromCharCode(i);
		if (pattern.test(character) === true) {
			characters += character;
		}
	}
	return characters;
}