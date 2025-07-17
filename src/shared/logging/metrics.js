const logger = require('./logger');

class MetricsCollector {
  constructor() {
    this.metrics = {
      automationRuns: {},
      executionTimes: {},
      errorCounts: {},
      successCounts: {}
    };
  }

  recordAutomationStart(automationName) {
    const key = `${automationName}_${Date.now()}`;
    this.metrics.automationRuns[key] = {
      name: automationName,
      startTime: Date.now(),
      status: 'running'
    };
    
    logger.info(`Automation started: ${automationName}`, {
      automation: automationName,
      status: 'started',
      timestamp: Date.now()
    });
    
    return key;
  }

  recordAutomationEnd(key, status = 'success', error = null) {
    if (!this.metrics.automationRuns[key]) return;
    
    const run = this.metrics.automationRuns[key];
    const endTime = Date.now();
    const executionTime = endTime - run.startTime;
    
    run.endTime = endTime;
    run.executionTime = executionTime;
    run.status = status;
    run.error = error;
    
    // Update aggregated metrics
    if (!this.metrics.executionTimes[run.name]) {
      this.metrics.executionTimes[run.name] = [];
    }
    this.metrics.executionTimes[run.name].push(executionTime);
    
    if (status === 'success') {
      this.metrics.successCounts[run.name] = (this.metrics.successCounts[run.name] || 0) + 1;
    } else {
      this.metrics.errorCounts[run.name] = (this.metrics.errorCounts[run.name] || 0) + 1;
    }
    
    logger.info(`Automation completed: ${run.name}`, {
      automation: run.name,
      status,
      executionTime,
      error: error ? error.message : null
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      summary: this.generateSummary()
    };
  }

  generateSummary() {
    const summary = {};
    
    Object.keys(this.metrics.executionTimes).forEach(automationName => {
      const times = this.metrics.executionTimes[automationName];
      const successCount = this.metrics.successCounts[automationName] || 0;
      const errorCount = this.metrics.errorCounts[automationName] || 0;
      const totalRuns = successCount + errorCount;
      
      summary[automationName] = {
        totalRuns,
        successCount,
        errorCount,
        successRate: totalRuns > 0 ? (successCount / totalRuns * 100).toFixed(2) : 0,
        avgExecutionTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : 0,
        minExecutionTime: times.length > 0 ? Math.min(...times) : 0,
        maxExecutionTime: times.length > 0 ? Math.max(...times) : 0
      };
    });
    
    return summary;
  }

  reset() {
    this.metrics = {
      automationRuns: {},
      executionTimes: {},
      errorCounts: {},
      successCounts: {}
    };
    logger.info('Metrics reset');
  }
}

module.exports = new MetricsCollector();