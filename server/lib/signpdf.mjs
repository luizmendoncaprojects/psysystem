// Builds the document PDF and signs it with the psychologist's A1 certificate.
// Signature format: PAdES baseline B-B (ETSI.CAdES.detached, ETSI EN 319 142), the format validar.iti.gov.br checks.
// The signature is embedded in the PDF: any later change to the file makes it show as invalid.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SignPdf, Signer } from '@signpdf/signpdf';
import forge from 'node-forge';

const { asn1 } = forge;
const SEQ = (v) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, v);
const SET = (v) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, v);
const OID = (o) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(o).getBytes());
const OCT = (bytes) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, bytes);
const INT = (n) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(n).getBytes());
const NULL = () => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '');
const CTX = (n, v, constructed = true) => asn1.create(asn1.Class.CONTEXT_SPECIFIC, n, constructed, v);
const der = (a) => asn1.toDer(a).getBytes();
const serial = (cert) => { // positive INTEGER from the hex serial
  const hex = cert.serialNumber.length % 2 ? `0${cert.serialNumber}` : cert.serialNumber;
  const bytes = forge.util.hexToBytes(hex);
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, bytes.charCodeAt(0) & 0x80 ? `\0${bytes}` : bytes);
};
const SHA256 = () => SEQ([OID(forge.pki.oids.sha256), NULL()]);
const attr = (oid, value) => SEQ([OID(oid), SET([value])]);

// CMS SignedData (detached) with the attributes CAdES-BES needs: content-type, message-digest and
// signing-certificate-v2 (binds the signer's certificate). No signing-time: PAdES puts the time in the PDF (/M).
export class CadesSigner extends Signer {
  constructor(pfx, passphrase) { super(); this.pfx = pfx; this.passphrase = passphrase; }

  async sign(pdfBuffer) {
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1.fromDer(forge.util.createBuffer(this.pfx.toString('binary'))), this.passphrase);
    const keyBag = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag].flatMap((t) => p12.getBags({ bagType: t })[t] ?? [])[0];
    const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map((b) => b.cert);
    const key = keyBag.key;
    const cert = certs.find((c) => c.publicKey.n.equals(key.n));
    if (!cert) throw new Error('O certificado não corresponde à chave privada.');

    const certDer = der(forge.pki.certificateToAsn1(cert));
    const sha = (bytes) => forge.md.sha256.create().update(bytes).digest().getBytes();
    const issuerSerial = SEQ([SEQ([CTX(4, [forge.pki.distinguishedNameToAsn1(cert.issuer)])]), serial(cert)]);
    const attrs = [
      attr(forge.pki.oids.contentType, OID(forge.pki.oids.data)),
      attr(forge.pki.oids.messageDigest, OCT(sha(pdfBuffer.toString('binary')))),
      attr('1.2.840.113549.1.9.16.2.47', SEQ([SEQ([SEQ([OCT(sha(certDer)), issuerSerial])])])), // signing-certificate-v2, SHA-256
    ].map((a) => ({ a, d: der(a) })).sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0)).map((x) => x.a); // DER: SET OF sorted
    const signature = key.sign(forge.md.sha256.create().update(der(SET(attrs)))); // signed over the SET (tag 0x31)

    const signerInfo = SEQ([
      INT(1),
      SEQ([forge.pki.distinguishedNameToAsn1(cert.issuer), serial(cert)]),
      SHA256(),
      CTX(0, attrs), // [0] IMPLICIT signedAttrs
      SEQ([OID(forge.pki.oids.rsaEncryption), NULL()]),
      OCT(signature),
    ]);
    const signedData = SEQ([
      INT(1),
      SET([SHA256()]),
      SEQ([OID(forge.pki.oids.data)]), // detached: no content
      CTX(0, certs.map((c) => forge.pki.certificateToAsn1(c))),
      SET([signerInfo]),
    ]);
    return Buffer.from(der(SEQ([OID(forge.pki.oids.signedData), CTX(0, [signedData])])), 'binary');
  }
}

// Same monotone curve as smoothPath in src/ui.js (kept in sync by hand: the API cannot import the React code).
function smoothPath(pts) {
  const n = pts.length;
  const f = (v) => v.toFixed(1);
  const dx = []; const m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])));
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(pts[i][0] + h)} ${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}

const A4 = [595.28, 841.89];
const M = 64; // page margin
const INK = rgb(0.11, 0.1, 0.15);
const MUTED = rgb(0.42, 0.41, 0.47);
// Standard PDF fonts only encode WinAnsi (Latin-1 plus a few marks); anything else becomes "?".
const winAnsi = (s) => String(s ?? '').replace(/[^\t\n\r\x20-\x7E\xA0-\xFF‘’“”–—•…€]/gu, '?');

function wrap(text, font, size, width) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

// doc: { title, body, author, crp, place, dateLong, signedBy, issuer, signedAt, code }
export async function buildPdf(doc) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(winAnsi(doc.title));
  pdf.setAuthor(winAnsi(doc.author));
  pdf.setProducer('KiWave');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = A4[0] - M * 2;
  let page = pdf.addPage(A4);
  let y = A4[1] - M;
  const pages = [page];
  const write = (text, { f = font, size = 11, color = INK, gap = 4, center = false } = {}) => {
    for (const line of wrap(winAnsi(text), f, size, width)) {
      if (y < M + 150) { page = pdf.addPage(A4); pages.push(page); y = A4[1] - M; } // keep room for the signature stamp
      const x = center ? (A4[0] - f.widthOfTextAtSize(line, size)) / 2 : M;
      page.drawText(line, { x, y, size, font: f, color });
      y -= size + gap;
    }
  };

  write(`${doc.author} · Psicóloga ${doc.crp}`, { size: 9, color: MUTED });
  y -= 18;
  write(String(doc.title || 'Documento').toUpperCase(), { f: bold, size: 14, center: true });
  y -= 14;

  // Line charts { title, min, max, points: (number|null)[], labels: [first, last] }, full width.
  // A body line "[[grafico:N]]" draws chart N right there (report: text, chart, text, chart).
  const charts = (doc.charts ?? []).slice(0, 6);
  const ch = 120;
  const drawChart = (c) => {
    if (y - ch < M + 150) { page = pdf.addPage(A4); pages.push(page); y = A4[1] - M; }
    y -= ch;
    page.drawRectangle({ x: M, y, width, height: ch, borderColor: rgb(0.86, 0.85, 0.88), borderWidth: 0.6 });
    page.drawText(winAnsi(c.title), { x: M + 10, y: y + ch - 16, size: 9, font: bold, color: INK });
    const plot = { x: M + 12, y: y + 18, w: width - 24, h: ch - 44 };
    const pts = c.points.map((v, k) => (v == null ? null : {
      x: plot.x + (c.points.length > 1 ? (k * plot.w) / (c.points.length - 1) : plot.w / 2),
      y: plot.y + ((Math.min(c.max, Math.max(c.min, v)) - c.min) / (c.max - c.min || 1)) * plot.h,
    })).filter(Boolean);
    page.drawLine({ start: { x: plot.x, y: plot.y }, end: { x: plot.x + plot.w, y: plot.y }, thickness: 0.4, color: MUTED });
    // drawSvgPath: origin at the top-left of the plot, y pointing down.
    if (pts.length > 1) page.drawSvgPath(smoothPath(pts.map((pt) => [pt.x - plot.x, plot.y + plot.h - pt.y])), { x: plot.x, y: plot.y + plot.h, borderColor: rgb(0.36, 0.31, 0.88), borderWidth: 1.4 });
    pts.forEach((pt) => page.drawCircle({ x: pt.x, y: pt.y, size: 1.4, color: rgb(0.36, 0.31, 0.88) }));
    if (!pts.length) page.drawText(winAnsi('Sem registros no período'), { x: plot.x, y: plot.y + plot.h / 2, size: 8, font, color: MUTED });
    const [l0, l1] = c.labels ?? [];
    if (l0) page.drawText(winAnsi(l0), { x: plot.x, y: y + 6, size: 7, font, color: MUTED });
    if (l1) page.drawText(winAnsi(l1), { x: plot.x + plot.w - font.widthOfTextAtSize(winAnsi(l1), 7), y: y + 6, size: 7, font, color: MUTED });
    y -= 14;
  };
  const MARK = /^\[\[grafico:(\d+)\]\]$/;
  if (!String(doc.body).split('\n').some((l) => MARK.test(l.trim()))) charts.forEach(drawChart); // no markers: charts on top
  for (const block of String(doc.body).split(/\n{2,}/)) {
    for (const line of block.split('\n')) {
      const mark = line.trim().match(MARK);
      if (mark) { if (charts[+mark[1]]) { y -= 4; drawChart(charts[+mark[1]]); } continue; }
      const heading = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,}$/.test(line.trim());
      write(line || ' ', heading ? { f: bold, size: 11 } : { size: 11, gap: 5 });
    }
    y -= 10;
  }
  y -= 10;
  write(`${doc.place}, ${doc.dateLong}.`);
  y -= 40;
  page.drawLine({ start: { x: A4[0] / 2 - 120, y: y + 12 }, end: { x: A4[0] / 2 + 120, y: y + 12 }, thickness: 0.6, color: MUTED });
  write(doc.author, { f: bold, center: true });
  write(`Psicóloga · ${doc.crp}`, { size: 10, color: MUTED, center: true });

  // Visible stamp on the last page (the cryptographic signature itself is invisible and covers the whole file).
  const box = { x: M, y: M - 10, w: width, h: 74 };
  page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, borderColor: rgb(0.36, 0.31, 0.88), borderWidth: 0.8, color: rgb(0.97, 0.96, 1) });
  const stamp = [
    [`Assinado digitalmente por ${doc.signedBy}`, bold],
    [`Data: ${doc.signedAt} · Certificado ICP-Brasil emitido por ${doc.issuer}`, font],
    [`Código de verificação KiWave: ${doc.code} · Confira a assinatura em validar.iti.gov.br`, font],
  ];
  stamp.forEach(([t, f], i) => {
    const line = wrap(winAnsi(t), f, 8.5, box.w - 24)[0];
    page.drawText(line, { x: box.x + 12, y: box.y + box.h - 20 - i * 16, size: 8.5, font: f, color: i ? MUTED : INK });
  });
  pages.forEach((p, i) => p.drawText(`Página ${i + 1} de ${pages.length}`, { x: A4[0] - M - 60, y: 28, size: 8, font, color: MUTED }));

  pdflibAddPlaceholder({ pdfDoc: pdf, reason: winAnsi(`${doc.title} · ${doc.code}`), contactInfo: '', name: winAnsi(doc.signedBy), location: winAnsi(doc.place), appName: 'KiWave', subFilter: 'ETSI.CAdES.detached', signatureLength: 16384 });
  return Buffer.from(await pdf.save({ useObjectStreams: false })); // signpdf needs a plain xref table
}

export const signPdf = (pdfBuffer, pfxBuffer, passphrase) => new SignPdf().sign(pdfBuffer, new CadesSigner(pfxBuffer, passphrase));
