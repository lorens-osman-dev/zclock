export const EXTENSION_NAME = 'zclock';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const TAG = `${CYAN}[${EXTENSION_NAME}]${RESET}`;
const ETAG = `${RED}[${EXTENSION_NAME} ERROR]${RESET}`;
export const Logger = {
    info(msg) {
        print(`${TAG} ${msg}`);
    },
    error(context, error) {
        let output = `${ETAG} ${context}`;
        if (error) {
            const err = error;
            const lines = err.stack
                ? err.stack.split('\n').filter(l => l.trim() !== '')
                : [`${err.message ?? error}`];
            for (const line of lines) {
                output += `\n${YELLOW}[${EXTENSION_NAME}]  ↳ ${line.trim()}${RESET}`;
            }
        }
        printerr(output);
    },
};
