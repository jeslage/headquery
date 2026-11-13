/** Whether `value` is an http(s) URL (as opposed to a file path). */
export const isUrl = (value: string) => /^https?:\/\//i.test(value);

/** `https://cms.test/` → `https://cms.test`. */
export const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");
