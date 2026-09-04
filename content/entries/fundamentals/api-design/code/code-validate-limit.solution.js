function validateLimit(value) {
  return Number.isInteger(value) && value >= 1 && value <= 100 ? value : null;
}
