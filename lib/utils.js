function validateParameters(parameters) {
  for (const [key, config] of Object.entries(parameters)) {
    const { value, required = false, type, options } = config;
    
    if (required && (value === undefined || value === null || value === '')) {
      throw new Error(`Parameter '${key}' is required`);
    }
    
    if (value !== undefined && value !== null && type && typeof value !== type) {
      throw new Error(`Parameter '${key}' must be of type ${type}`);
    }
    
    if (options && !options.includes(value)) {
      throw new Error(`Parameter '${key}' must be one of: ${options.join(', ')}`);
    }
  }
}

function createHash(input, algorithm = 'md5') {
  return crypto.createHash(algorithm).update(input).digest('hex');
}

module.exports = {
  validateParameters,
  createHash
};