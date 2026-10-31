// src/logger.ts
/**
* core/logger.js — Colorized Logger
*
* Responsibility:
* - Provide consistent, grep-friendly logging with ANSI colors
* - Format stack traces so `journalctl | grep Azkar` catches every line
*
* Does NOT:
* - Access any GNOME APIs
* - Hold any state
*/
var EXTENSION_NAME = "zclock";
var CYAN = "\x1B[36m";
var RED = "\x1B[31m";
var YELLOW = "\x1B[33m";
var RESET = "\x1B[0m";
var TAG = `${CYAN}[${EXTENSION_NAME}]${RESET}`;
var ETAG = `${RED}[${EXTENSION_NAME} ERROR]${RESET}`;
var Logger = {
	/**
	* Log an informational message.
	* Visible in: journalctl -f -o cat /usr/bin/gnome-shell | grep Azkar
	* @param {string} msg
	* @returns {void}
	*/
	info(msg) {
		print(`${TAG} ${msg}`);
	},
	/**
	* Log an error with a full stack trace.
	* Every line is prefixed with [Azkar] so grep keeps it.
	* @param {string} context
	* @param {unknown} [error]
	* @returns {void}
	*/
	error(context, error) {
		let output = `${ETAG} ${context}`;
		if (error) {
			/** @type {{ stack?: string, message?: string }} */
			const err = error;
			const lines = err.stack ? err.stack.split("\n").filter((l) => l.trim() !== "") : [`${err.message ?? error}`];
			for (const line of lines) output += `\n${YELLOW}[${EXTENSION_NAME}]  ↳ ${line.trim()}${RESET}`;
		}
		printerr(output);
	}
};
export { EXTENSION_NAME, Logger };
