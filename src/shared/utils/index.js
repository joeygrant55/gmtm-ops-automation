const logger = require('../logging/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`Attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        throw error;
      }
      
      await sleep(delay * (i + 1));
    }
  }
};

const formatDate = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};

const formatDateTime = (date = new Date()) => {
  return date.toISOString();
};

const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const deepMerge = (target, source) => {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const truncateString = (str, length = 100) => {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

module.exports = {
  sleep,
  retry,
  formatDate,
  formatDateTime,
  sanitizeFilename,
  chunkArray,
  deepMerge,
  validateEmail,
  truncateString
};