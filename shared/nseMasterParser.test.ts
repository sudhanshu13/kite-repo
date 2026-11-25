import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvLine, parseNseEquityCsv, parseNseEtfCsv } from './nseMasterParser.ts';

test('parseCsvLine preserves commas inside quoted company names', () => {
  const cols = parseCsvLine('INDIACEM,"The India Cements, Limited",EQ,31-MAY-2000,10,1,INE383A01012,10');
  assert.equal(cols[0], 'INDIACEM');
  assert.equal(cols[1], 'The India Cements, Limited');
  assert.equal(cols[2], 'EQ');
  assert.equal(cols[5], '1');
});

test('parseNseEquityCsv parses official NSE equity rows with deterministic tokens and yahooSymbol', () => {
  const sample = [
    'SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE',
    'INDIACEM,The India Cements Limited,EQ,31-MAY-2000,10,1,INE383A01012,10',
    'INDIAGLYCO,India Glycols Limited,EQ,01-JUL-2005,5,1,INE560A01023,5',
    'DUP,Duplicate Co,EQ,01-JAN-2020,10,1,INE000000001,10',
    'DUP,Duplicate Co Again,EQ,01-JAN-2020,10,1,INE000000001,10',
  ].join('\n');

  const parsed = parseNseEquityCsv(sample);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].symbol, 'INDIACEM');
  assert.equal(parsed[0].name, 'The India Cements Limited');
  assert.equal(parsed[0].exchange, 'NSE');
  assert.equal(parsed[0].yahooSymbol, 'INDIACEM.NS');
  assert.equal(parsed[0].instrumentType, 'EQ');
});

test('parseNseEtfCsv parses official NSE ETF rows cleanly', () => {
  const sample = [
    'Symbol,Underlying Asset,SecurityName,DateofListing,MarketLot,ISINNumber,FaceValue,ETF Underlying,Underlying Key',
    'NIFTYBEES,Nifty 50,NIPINDETFNIFTYBEES,08-Jan-02,1,INF204KB14I2,1,EQ,Nifty 50',
    'GOLDBEES,Gold,Nippon India ETF Gold BeES,19-Mar-07,1,INF204KB17I5,1,Commodity,Gold',
  ].join('\n');

  const parsed = parseNseEtfCsv(sample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].symbol, 'NIFTYBEES');
  assert.equal(parsed[0].sector, 'ETF');
  assert.equal(parsed[0].yahooSymbol, 'NIFTYBEES.NS');
  assert.ok(parsed[0].name.includes('Nifty 50'));
});
