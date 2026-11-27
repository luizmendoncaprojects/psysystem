// Digital certificate (ICP-Brasil A1, .pfx/.p12). File and password are stored encrypted (AES-256-GCM).
// CERT_KEY: 32 random bytes in base64, the same value everywhere that shares the database.
import crypto from 'node:crypto';
import forge from 'node-forge';

const fail = (status, message) => Object.assign(new Error(message), { status });

const key = () => {
  const k = Buffer.from((process.env.CERT_KEY ?? '').trim(), 'base64');
  if (k.length !== 32) throw fail(502, 'CERT_KEY ausente ou inválida no servidor (32 bytes em base64).');
  return k;
};

export function seal(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), ct].map((x) => (typeof x === 'string' ? x : x.toString('base64'))).join('.');
}

export function unseal(sealed) {
  const [v, iv, tag, ct] = String(sealed).split('.');
  if (v !== 'v1') throw fail(500, 'Formato do certificado salvo desconhecido.');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  try {
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch {
    // Wrong key (CERT_KEY differs from the one that encrypted the data) or tampered data.
    throw fail(502, 'Não foi possível abrir os dados criptografados: o CERT_KEY deste servidor é diferente do usado para salvá-los. Use o mesmo CERT_KEY em todos os ambientes ou envie o certificado de novo.');
  }
}

// Opens the .pfx with the password: proves the password is right and reads the holder and validity.
export function inspect(pfxBase64, password) {
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(pfxBase64)), password);
  } catch (e) {
    throw fail(400, /password|MAC/i.test(e.message) ? 'Senha do certificado incorreta.' : 'Arquivo não é um certificado .pfx/.p12 válido.');
  }
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map((b) => b.cert).filter(Boolean);
  const keys = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag].flatMap((t) => p12.getBags({ bagType: t })[t] ?? []);
  if (!certs.length || !keys.length) throw fail(400, 'O arquivo precisa conter o certificado e a chave privada (tipo A1).');
  // The holder's certificate is the one that is not a CA.
  const cert = certs.find((c) => !c.getExtension('basicConstraints')?.cA) ?? certs[0];
  return {
    subject: cert.subject.getField('CN')?.value ?? 'Titular desconhecido',
    issuer: cert.issuer.getField('CN')?.value ?? '',
    validUntil: cert.validity.notAfter.toISOString(),
  };
}
