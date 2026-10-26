import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Secret from 'gi://Secret';

import nacl from './tweetnacl.js';

const KEY_SCHEMA = new Secret.Schema(
  'org.gnome.shell.extensions.clipboard-history-plus.key',
  Secret.SchemaFlags.NONE,
  {},
);
const NONCE_LENGTH = nacl.secretbox.nonceLength;

let key;

nacl.setPRNG((x, n) => {
  const stream = Gio.File.new_for_path('/dev/urandom').read(null);
  x.set(stream.read_bytes(n, null).toArray());
  stream.close(null);
});

export function init(callback) {
  Secret.password_lookup(KEY_SCHEMA, {}, null, (_, res) => {
    const storedKey = Secret.password_lookup_finish(res);
    if (storedKey) {
      key = GLib.base64_decode(storedKey);
      callback();
      return;
    }

    const newKey = nacl.randomBytes(nacl.secretbox.keyLength);
    Secret.password_store(
      KEY_SCHEMA,
      {},
      Secret.COLLECTION_DEFAULT,
      'Clipboard History encryption key',
      GLib.base64_encode(newKey),
      null,
      (_, res) => {
        Secret.password_store_finish(res);
        key = newKey;
        callback();
      },
    );
  });
}

export function encrypt(data) {
  const nonce = nacl.randomBytes(NONCE_LENGTH);
  const box = nacl.secretbox(data, nonce, key);

  const result = new Uint8Array(NONCE_LENGTH + box.length);
  result.set(nonce);
  result.set(box, NONCE_LENGTH);
  return result;
}

export function decrypt(data) {
  const plain = nacl.secretbox.open(
    data.subarray(NONCE_LENGTH),
    data.subarray(0, NONCE_LENGTH),
    key,
  );
  if (!plain) {
    throw new Error('Failed to decrypt clipboard entry');
  }
  return plain;
}
