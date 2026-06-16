// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export class GrindError extends Error {
  exitCode: number;
  cause?: Error;

  constructor(message: string, exitCode: number = 1, cause?: Error) {
    super(message);
    this.name = "GrindError";
    this.exitCode = exitCode;
    this.cause = cause;
  }
}

export class GrindUserError extends GrindError {
  constructor(message: string, cause?: Error) {
    super(message, 1, cause);
    this.name = "GrindUserError";
  }
}

export class GrindSystemError extends GrindError {
  constructor(message: string, cause?: Error) {
    super(message, 2, cause);
    this.name = "GrindSystemError";
  }
}
