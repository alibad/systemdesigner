function handler(event) {
  const request = event.request;
  const allowedQueryStrings = new Set(['format', 'lang', 'page']);

  for (const name of Object.keys(request.querystring)) {
    if (!allowedQueryStrings.has(name)) {
      delete request.querystring[name];
    }
  }

  request.uri = request.uri.replace(/\/{2,}/g, '/');
  if (request.uri !== '/' && request.uri.endsWith('/')) {
    request.uri = request.uri.slice(0, -1);
  }

  return request;
}
