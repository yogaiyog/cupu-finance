import { describe, it, expect } from 'vitest';
import { parseAmount, parseSheetDate, formatRupiah } from '../src/stores/expenseStore';

describe('parseAmount', () => {
  it('menangani angka murni (number)', () => {
    expect(parseAmount(20000)).toBe(20000);
    expect(parseAmount(0)).toBe(0);
    expect(parseAmount(1500.75)).toBe(1501);
  });

  it('menangani nilai kosong atau tidak valid', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('   ')).toBe(0);
    expect(parseAmount(NaN)).toBe(0);
  });

  it('mem-parsing format Rupiah standar yang dikembalikan Google Sheets', () => {
    expect(parseAmount('Rp 20.000')).toBe(20000);
    expect(parseAmount('Rp. 20.000')).toBe(20000);
    expect(parseAmount('Rp 20.000,00')).toBe(20000);
    expect(parseAmount('Rp 20,000')).toBe(20000);
    expect(parseAmount('Rp 20,000.00')).toBe(20000);
    expect(parseAmount('Rp20000')).toBe(20000);
  });

  it('mem-parsing format teks singkatan ribuan ("rb", "ribu", "k")', () => {
    expect(parseAmount('20rb')).toBe(20000);
    expect(parseAmount('20 rb')).toBe(20000);
    expect(parseAmount('20k')).toBe(20000);
    expect(parseAmount('20 k')).toBe(20000);
    expect(parseAmount('20ribu')).toBe(20000);
    expect(parseAmount('20 ribu')).toBe(20000);
    expect(parseAmount('20.5rb')).toBe(20500);
    expect(parseAmount('20,5rb')).toBe(20500);
    expect(parseAmount('20.5k')).toBe(20500);
    expect(parseAmount('20,5k')).toBe(20500);
  });

  it('mem-parsing format teks singkatan jutaan ("jt", "juta")', () => {
    expect(parseAmount('1jt')).toBe(1000000);
    expect(parseAmount('1 jt')).toBe(1000000);
    expect(parseAmount('1.5jt')).toBe(1500000);
    expect(parseAmount('1,5 jt')).toBe(1500000);
    expect(parseAmount('2juta')).toBe(2000000);
  });

  it('mem-parsing string angka dengan pemisah ribuan', () => {
    expect(parseAmount('20.000')).toBe(20000);
    expect(parseAmount('20,000')).toBe(20000);
    expect(parseAmount('20000')).toBe(20000);
    expect(parseAmount('1.250.000')).toBe(1250000);
  });
});

describe('parseSheetDate', () => {
  it('mem-parsing Google Sheets serial date number', () => {
    expect(parseSheetDate(46235)).toBe('2026-08-01');
    expect(parseSheetDate(46265)).toBe('2026-08-31');
    expect(parseSheetDate('46235')).toBe('2026-08-01');
  });

  it('mempertahankan string ISO YYYY-MM-DD', () => {
    expect(parseSheetDate('2026-08-15')).toBe('2026-08-15');
    expect(parseSheetDate('2026-09-01')).toBe('2026-09-01');
  });
});

