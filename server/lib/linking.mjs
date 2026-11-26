// Link codes and patient sign-up validation. Pure functions (unit-tested in linking.test.mjs).
import crypto from 'node:crypto';

// 32 symbols without look-alikes (no 0/O, 1/I). 32 divides 256, so `byte % 32` has no bias.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_DAYS = 7;
export const newCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % 32]).join('');
export const normalizeCode = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isCode = (c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c);

export function validCpf(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len) => {
    const sum = [...d.slice(0, len)].reduce((s, n, i) => s + Number(n) * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

// Returns { data } with normalized fields, or { error } with a message for the user.
export function validateSignup(b, today = new Date()) {
  const name = String(b?.name ?? '').trim().replace(/\s+/g, ' ');
  const email = String(b?.email ?? '').trim().toLowerCase();
  const phone = String(b?.phone ?? '').replace(/\D/g, '');
  const cpf = String(b?.cpf ?? '').replace(/\D/g, '');
  const birth = String(b?.birth ?? '');
  const password = String(b?.password ?? '');
  if (name.split(' ').length < 2 || name.length > 120) return { error: 'Informe nome e sobrenome.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-mail inválido.' };
  if (phone.length < 10 || phone.length > 11) return { error: 'Telefone com DDD, só números.' };
  const bd = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? new Date(`${birth}T00:00:00Z`) : null;
  if (!bd || Number.isNaN(bd.getTime()) || bd > today || bd.getUTCFullYear() < 1900) return { error: 'Data de nascimento inválida.' };
  if (!validCpf(cpf)) return { error: 'CPF inválido.' };
  if (password.length < 10) return { error: 'A senha precisa de pelo menos 10 caracteres.' };
  if (b?.consent !== true) return { error: 'É preciso aceitar os termos para criar a conta.' };
  return { data: { name, email, phone, cpf, birth, password } };
}
