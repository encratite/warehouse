export function number(name: string, value: any, permitNull: boolean = false) {
	checkType(name, value, permitNull, 'number');
}

export function string(name: string, value: any, permitNull: boolean = false, maxLength: number = 128) {
	checkType(name, value, permitNull, 'string');
	if (value != null && (<string>value).length > maxLength) {
		throw new Error(`Length of "${name}" has been exceeded.`);
	}
}

export function boolean(name: string, value: any, permitNull: boolean = false) {
	checkType(name, value, permitNull, 'boolean');
}

export function object(name: string, value: any, permitNull: boolean = false) {
	checkType(name, value, permitNull, 'object');
}

export function array(name: string, value: any, permitNull: boolean = false, permitEmpty: boolean = true) {
	if (nullCheck(name, value, permitNull) === true) {
		return;
	}
	if (value instanceof Array === false) {
		throw new Error(`Unexpected type for argument "${name}". Expected an array.`);
	}
	if (permitEmpty === false && value.length === 0) {
		throw new Error(`Array "${name}" must not be empty.`)
	}
}

function checkType(name: string, value: any, permitNull: boolean, type: string) {
	if (nullCheck(name, value, permitNull) === true) {
		return;
	}
	const valueType = typeof value;
	if (valueType !== type) {
		throw new Error(`Unexpected type "${valueType}" for argument "${name}". Expected "${type}".`);
	}
}

function nullCheck(name: string, value: any, permitNull: boolean) {
	if (permitNull === false && value == null) {
		throw new Error(`Argument "${name}" may not be null.`);
	}
	return permitNull === true && value == null;
}