const Ajv = require("ajv")
const ajv = new Ajv()

const humanize = (errors) => {
  return errors.map(error => {
    const { instancePath, message, params } = error;
    const { additionalProperty } = params;
    const path = instancePath.replace('/', '');
    const property = additionalProperty || path;
    error.field = property;
    error.human = `${property} ${message}`;
    return error;
  })
}

module.exports = (schema, data) => {
  const valid = ajv.validate(schema, data);
  if (!valid) {
    let errors = ajv.errors;
    errors = humanize(errors);
    throw new Error(JSON.stringify(errors));
  }
}
