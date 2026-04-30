const axios = require('axios');

const API_URL = 'http://localhost:3000/api/signals';

const components = [
  'RDBMS_MAIN_CLUSTER',
  'CACHE_CLUSTER_01',
  'MCP_HOST_EU_WEST',
  'ASYNC_QUEUE_WORKER'
];

async function runMock() {
  console.log("Starting mock failure event simulation...");
  
  // Simulate RDBMS failure (high volume)
  console.log("Simulating RDBMS outage (100 signals in 1 sec)");
  for (let i = 0; i < 100; i++) {
    axios.post(API_URL, {
      componentId: 'RDBMS_MAIN_CLUSTER',
      type: 'CONNECTION_REFUSED',
      payload: { error: 'TCP Timeout', latency: 5000 + i }
    }).catch(() => {});
  }
  
  await new Promise(res => setTimeout(res, 2000));
  
  // Simulate subsequent MCP failure
  console.log("Simulating MCP host failure (Cascading)");
  for (let i = 0; i < 50; i++) {
    axios.post(API_URL, {
      componentId: 'MCP_HOST_EU_WEST',
      type: 'HEALTHCHECK_FAILED',
      payload: { memory: '99%', cpu: '100%' }
    }).catch(() => {});
  }

  console.log("Done firing mock signals!");
}

runMock();
