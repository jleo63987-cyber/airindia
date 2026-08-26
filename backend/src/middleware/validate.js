import { HttpError } from "../utils/httpError.js";

/**
 * Express 5 note:
 * req.query is a getter and must NOT be reassigned.
 *
 * Parsed/validated values are also exposed through:
 *   req.validated.body
 *   req.validated.params
 *   req.validated.query
 *
 * Existing controllers can still read req.query because query validation here
 * does not need to replace it.
 */
export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new HttpError(
          422,
          "Validation failed.",
          result.error.flatten(),
        ),
      );
    }

    req.validated ||= {};
    req.validated[source] = result.data;

    // Body and params are writable. Express 5 req.query is getter-only.
    if (source === "body") {
      req.body = result.data;
    } else if (source === "params") {
      req.params = result.data;
    }

    next();
  };
}
