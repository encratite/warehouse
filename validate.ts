export function number(name: string, value: any) {
    const type = typeof value;
    if (type !== 'number') {
        throw new Error(`Unexpected type "${type}" for argument "${name}". Expected a number.`);
    }
}

export function string(name: string, value: any) {
    const type = typeof value;
    if (type !== 'string') {
        throw new Error(`Unexpected type "${type}" for argument "${name}". Expected a string.`);
    }
}

export function numberArray(name: string, value: any) {
    if (value instanceof Array === false) {
        throw new Error(`Unexpected type for argument "${name}". Expected an array.`);
    }
    value.forEach(element => {
        const type = typeof value;
        if (type !== 'number') {
            throw new Error(`Unexpected type "${type}" in array "${name}". Expected all elements to be numbers.`);
        }
    });
}