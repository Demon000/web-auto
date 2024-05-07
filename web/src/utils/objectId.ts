export const objectId = (() => {
    const map = new WeakMap();
    let counter = 0n;

    return (obj: any): bigint => {
        let id = map.get(obj);
        if (id === undefined) {
            id = counter++;
            map.set(obj, id);
        }

        return id;
    };
})();
