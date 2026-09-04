function countRecent(timestamps, now, width) {
  return timestamps.filter(t => t > now - width && t <= now).length;
}
