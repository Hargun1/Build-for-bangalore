// Validates req.body (or req.query) with a zod schema and replaces it with the
// parsed value, so handlers only ever see whitelisted, typed fields.
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join(".");
      return res.status(400).json({
        message: field ? `${field}: ${issue.message}` : issue.message,
        issues: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    if (source === "query") {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    return next();
  };
}

module.exports = validate;
