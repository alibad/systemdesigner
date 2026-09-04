function routeHealthy(servers, requestIndex) {
  const healthy = servers.filter(s => s.healthy); return healthy.length ? healthy[requestIndex % healthy.length].id : null;
}
