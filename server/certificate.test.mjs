import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import forge from 'node-forge';

process.env.CERT_KEY = crypto.randomBytes(32).toString('base64');
const { seal, unseal, inspect } = await import('./lib/certificate.mjs');

function makePfx(password) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: 'DEBORA TESTE:12345678900' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' });
  return forge.util.encode64(forge.asn1.toDer(asn1).getBytes());
}

test('seal/unseal round-trips and detects tampering', () => {
  const s = seal('senha-do-certificado');
  assert.notEqual(s, 'senha-do-certificado');
  assert.equal(unseal(s), 'senha-do-certificado');
  const [v, iv, tag, ct] = s.split('.');
  const bad = [v, iv, tag, Buffer.from('x' + Buffer.from(ct, 'base64').toString('latin1'), 'latin1').toString('base64')].join('.');
  assert.throws(() => unseal(bad));
});

test('buildPdf + signPdf embed a signature whose digest covers the whole file', async () => {
  const { buildPdf, signPdf } = await import('./lib/signpdf.mjs');
  const pdf = await buildPdf({ title: 'Declaração', body: 'Texto ção 😀', author: 'Débora', crp: 'CRP 09/1', place: 'Goiânia', dateLong: '1 de dezembro de 2026', signedBy: 'DEBORA', issuer: 'AC', signedAt: '01/12/2026 10:00', code: 'KW-0000-0000' });
  const signed = await signPdf(pdf, Buffer.from(makePfx('x1'), 'base64'), 'x1');
  const s = signed.toString('latin1');
  const [a, b, c, d] = s.match(/\/ByteRange\s*\[\s*(\d+) (\d+) (\d+) (\d+)\s*\]/).slice(1).map(Number);
  assert.equal(a, 0);
  assert.equal(c + d, signed.length); // signed ranges reach the end of the file
  const hex = s.slice(b + 1, c - 1).replace(/0+$/, '');
  const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex').toString('binary'))));
  const md = p7.rawCapture.authenticatedAttributes.find((x) => forge.asn1.derToOid(x.value[0].value) === forge.pki.oids.messageDigest).value[1].value[0].value;
  const digest = crypto.createHash('sha256').update(Buffer.concat([signed.subarray(0, b), signed.subarray(c)])).digest('binary');
  assert.equal(md, digest);
});

test('inspect reads holder and validity, rejects wrong password and junk', () => {
  const pfx = makePfx('certo123');
  assert.deepEqual(inspect(pfx, 'certo123'), { subject: 'DEBORA TESTE:12345678900', issuer: 'DEBORA TESTE:12345678900', validUntil: '2027-01-01T00:00:00.000Z' });
  assert.throws(() => inspect(pfx, 'errada'), /Senha do certificado incorreta/);
  assert.throws(() => inspect(Buffer.from('nada').toString('base64'), 'x'), /não é um certificado/);
});
