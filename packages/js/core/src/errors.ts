export class HeadqueryError extends Error {
  override readonly name: string = "HeadqueryError";
}

/** The CMS answered with a non-2xx status. */
export class HeadqueryHttpError extends HeadqueryError {
  override readonly name = "HeadqueryHttpError";
  constructor(
    readonly status: number,
    readonly url: string,
    /** Parsed JSON body if the response was JSON, otherwise the raw text. */
    readonly body: unknown,
  ) {
    super(`CMS API responded ${status} for ${url}`);
  }
}

/** The request never produced a response (network, CORS, abort, invalid JSON). */
export class HeadqueryNetworkError extends HeadqueryError {
  override readonly name = "HeadqueryNetworkError";
  constructor(
    readonly url: string,
    override readonly cause: unknown,
  ) {
    super(`Request to ${url} failed`);
  }
}
