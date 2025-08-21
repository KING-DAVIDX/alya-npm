const crypto = require('crypto');

function validateParameters(parameters) {
  for (const [key, config] of Object.entries(parameters)) {
    const { value, required = false, type, options } = config;
    
    if (required && (value === undefined || value === null || value === '')) {
      throw new Error(`Parameter '${key}' is required`);
    }
    
    if (value !== undefined && value !== null && type) {
      // Special handling for Buffer type
      if (type === 'buffer') {
        if (!Buffer.isBuffer(value)) {
          throw new Error(`Parameter '${key}' must be of type buffer`);
        }
      } 
      // Handle array of allowed types
      else if (Array.isArray(type)) {
        if (!type.some(t => {
          if (t === 'buffer') return Buffer.isBuffer(value);
          return typeof value === t;
        })) {
          throw new Error(`Parameter '${key}' must be one of types: ${type.join(', ')}`);
        }
      }
      // Handle single type
      else if (typeof value !== type) {
        throw new Error(`Parameter '${key}' must be of type ${type}`);
      }
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