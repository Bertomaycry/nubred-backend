/** An error asyncHandler answers with as-is (it reads `code` as the HTTP status). */
export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.code = status;
  }
}
