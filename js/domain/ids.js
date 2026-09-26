const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function makeUlid() {
  const time = Date.now().toString(36).padStart(10, '0');
  const random = Array.from({ length: 16 }, () => CROCKFORD[Math.floor(Math.random() * CROCKFORD.length)]).join('');
  return `${time}${random}`.slice(0, 26);
}

export function makeEntityId(prefix) {
  if (!prefix) throw new Error('An entity prefix is required');
  return `${prefix}_${makeUlid()}`;
}
