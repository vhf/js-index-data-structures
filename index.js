/*
This file is adapted from bplus-index's benchmark
Copyright (c) 2015, InternalFX
https://github.com/internalfx/bplus-index/blob/master/LICENSE
*/
const _ = require('lodash');
const faker = require('faker');

const BPlusIndex = require('bplus-index');
const BPlusTree = require('bplustree');
const Benchmark = require('benchmark');
const Set = require('sorted-map');

const async = require('async');
const l = require('log-anything');

const db = [];
const dbSize = [1, 100, 500, 2000][2];
const bf = 18;

Benchmark.support.decompilation = false;

const assert = (actual, expected, msg, fn) => {
  if (!fn(actual, expected)) {
    l.log('expected', expected);
    l.log('actual', actual);
    throw new Error(msg);
  }
};

const methods = ['bplus-index', 'bplustree', 'sorted-map (u)', 'array'];

const finalResults = [];

const compileResult = (results) => {
  const table = [];
  for (let i = 0; i < methods.length; i++) {
    table.push([methods[i], results[i].toFixed(2), 'ops/sec']);
  }
  table.push([]);

  const zip = _.zip(methods, results);
  const order = _.sortBy(zip, 1).reverse();

  for (let i = 1; i < order.length; i++) {
    const speedup = order[i - 1][1] / order[i][1];
    table.push([order[i - 1][0], speedup.toFixed(2), 'x faster than', order[i][0]]);

    let adj = 'fast';
    if (i === order.length - 1) {
      adj = 'slow';
    }
    if (speedup > 50) {
      table[table.length - 1].push(`(ultra ${adj})`);
    } else if (speedup > 25) {
      table[table.length - 1].push(`(super ${adj})`);
    } else if (speedup > 10) {
      table[table.length - 1].push(`(${adj})`);
    }
  }
  table.push([]);

  _.map(order, (o, i) => {
    const method = o[0];
    const place = i + 1;
    const score = _.max(results) / o[1];
    if (_.find(finalResults, _.matches({ 'method': method })) === undefined) {
      finalResults.push({ method, score, places: [place] });
    } else {
      const index = _.findIndex(finalResults, { method });
      finalResults[index].score += score;
      finalResults[index].places.push(place);
    }
  });

  return table;
};

const compileFinalResults = () => {
  const ordered = _.sortBy(finalResults, 'score');
  const min = ordered[0].score;

  l.log('Final results:');
  const table = [];
  table.push(['', '', 'i', 'g', 'a', 'r', 'e', '']);
  for (let i = 0; i < ordered.length; i++) {
    const cur = (ordered[i].score / min).toFixed(2);
    const method = ordered[i].method;
    table.push([cur, method].concat(ordered[i].places));
  }
  return table;
};

l.log('Creating database of ' + dbSize + ' records');
for (let i = 0; i < dbSize; i++) {
  const rec = {
    age: faker.random.number({ max: 90 }),
    name: faker.name.findName(),
  };
  db.push(rec);
}

const smallestKey = _.pluck(db, 'age').sort()[0];
const highestKey = _.pluck(db, 'age').sort().reverse()[0];
const smallestValue = _.pluck(db, 'name').sort()[0];
const highestValue = _.pluck(db, 'name').sort().reverse()[0];
const uniqueKeys = _.chain(db).pluck('age').unique().value().length;

const insert = (done) => {
  l.log('Testing inject(key, value)');

  const suite = new Benchmark.Suite();
  const results = [];
  let ds;

  suite.add({
    name: 'bplus-index',
    setup: () => {
      ds = new BPlusIndex({ debug: false, branchingFactor: bf });
    },
    fn: () => {
      for (const rec of db) {
        ds.inject(rec.age, rec.name);
      }
    },
  });

  suite.add({
    name: 'bplustree',
    setup: () => {
      ds = new BPlusTree({ order: bf });
    },
    fn: () => {
      for (const rec of db) {
        ds.store(rec.age, rec.name);
      }
    },
  });

  suite.add({
    name: 'sorted-map',
    setup: () => {
      ds = new Set();
    },
    fn: () => {
      for (const rec of db) {
        ds.set(rec.age, rec.name);
      }
    },
  });

  suite.add({
    name: 'array',
    setup: () => {
      ds = [];
    },
    fn: () => {
      for (const rec of db) {
        ds.push({ age: rec.age, name: rec.name });
      }
    },
  });

  suite.on('error', (event) => {
    throw new Error(event.target.error);
  });

  suite.on('complete', () => {
    suite.forEach((obj) => { results.push(obj.hz); });
    l.logt(compileResult(results));
    done();
  });

  suite.run();
};

const get = (done) => {
  l.log('Testing get(key)');

  const suite = new Benchmark.Suite();
  const results = [];

  const bplusindex = new BPlusIndex({ debug: false, branchingFactor: bf });
  const bplustree = new BPlusTree({ order: bf });
  const sortedMap = new Set();
  const array = [];

  for (const rec of db) {
    bplusindex.inject(rec.age, rec.name);
    bplustree.store(rec.age, rec.name);
    sortedMap.set(rec.age, rec.name);
    array.push({ age: rec.age, name: rec.name });
  }

  const randKeys = _.chain(db).pluck('age').shuffle().value();

  const numberToGet = 50;

  const expectedResult = [];
  for (let i = 0; i < numberToGet; i++) {
    expectedResult.push(bplustree.fetch(randKeys[i]));
  }

  let expected;

  suite.add({
    name: 'bplus-index',
    fn: () => {
      expected = [];
      for (let i = 0; i < numberToGet; i++) {
        expected.push(bplusindex.get(randKeys[i]));
      }
    },
    teardown: () => {
      assert(expected, expectedResult, 'bplus-index get error', (a, b) => { return _.isEqual(a.map((o) => _.sortBy(o)), b.map((o) => _.sortBy(o))); });
    },
  });

  suite.add({
    name: 'bplustree',
    fn: () => {
      expected = [];
      for (let i = 0; i < numberToGet; i++) {
        expected.push(bplustree.fetch(randKeys[i]));
      }
    },
    teardown: () => {
      assert(expected, expectedResult, 'bplustree get error', (a, b) => { return _.isEqual(a.map((o) => _.sortBy(o)), b.map((o) => _.sortBy(o))); });
    },
  });

  suite.add({
    name: 'sorted-map',
    fn: () => {
      expected = [];
      for (let i = 0; i < numberToGet; i++) {
        expected.push(sortedMap.get(randKeys[i]));
      }
    },
    teardown: () => {
      // assert(expected, expectedResult, 'sorted-map get error', (a, b) => { return _.isEqual(a.map((o) => _.sortBy(o)), b.map((o) => _.sortBy(o))); });
    },
  });

  suite.add({
    name: 'array',
    fn: () => {
      expected = [];
      for (let i = 0; i < numberToGet; i++) {
        expected.push(_.filter(array, { age: randKeys[i] }).map((o) => o.name));
      }
    },
    teardown: () => {
      assert(expected, expectedResult, 'array get error', (a, b) => { return _.isEqual(a.map((o) => _.sortBy(o)), b.map((o) => _.sortBy(o))); });
    },
  });

  suite.on('error', (event) => {
    throw new Error(event.target.error);
  });

  suite.on('complete', () => {
    suite.forEach((obj) => { results.push(obj.hz); });
    l.logt(compileResult(results));
    done();
  });

  suite.run();
};

const getAllValues = (done) => {
  l.log('Testing get all values');

  const suite = new Benchmark.Suite();
  const results = [];
  const bplusindex = new BPlusIndex({ debug: false, branchingFactor: bf });
  const bplustree = new BPlusTree({ order: bf });
  const sortedMap = new Set();
  const array = [];

  for (const rec of db) {
    bplusindex.inject(rec.age, rec.name);
    bplustree.store(rec.age, rec.name);
    sortedMap.set(rec.age, rec.name);
    array.push({ age: rec.age, name: rec.name });
  }

  const expectedResult = bplustree.repr({ getValues: true }).sort();
  let expected;

  suite.add({
    name: 'bplus-index',
    fn: () => {
      expected = bplusindex.getAll({ sortDescending: false });
    },
    teardown: () => {
      assert(expected.sort(), expectedResult, 'bplus-index getAll error', _.isEqual);
    },
  });

  suite.add({
    name: 'bplustree',
    fn: () => {
      expected = bplustree.repr({ getValues: true });
    },
    teardown: () => {
      assert(expected.sort(), expectedResult, 'bplustree getAll error', _.isEqual);
    },
  });

  suite.add({
    name: 'sorted-map',
    fn: () => {
      expected = sortedMap.range(smallestValue, highestValue);
    },
    teardown: () => {
      assert(expected.length, uniqueKeys, 'sorted-map getAll error', _.isEqual);
    },
  });

  suite.add({
    name: 'array',
    fn: () => {
      expected = _.sortByOrder(array, ['age'], ['asc']).map((o) => o.name);
    },
    teardown: () => {
      assert(expected.sort(), expectedResult, 'array getAll error', _.isEqual);
    },
  });

  suite.on('error', (event) => {
    throw new Error(event.target.error);
  });

  suite.on('complete', () => {
    suite.forEach((obj) => { results.push(obj.hz); });
    l.logt(compileResult(results));
    done();
  });

  suite.run();
};

const getRange = (done) => {
  l.log('Testing getRange(lowerBound, upperBound)');

  const suite = new Benchmark.Suite();
  const results = [];

  const bplusindex = new BPlusIndex({ debug: false, branchingFactor: bf });
  const bplustree = new BPlusTree({ order: bf });
  const sortedMap = new Set();
  const array = [];

  for (const rec of db) {
    bplusindex.inject(rec.age, rec.name);
    bplustree.store(rec.age, rec.name);
    sortedMap.set(rec.age, rec.name);
    array.push({ age: rec.age, name: rec.name });
  }

  const keys = _.chain(db).pluck('age').unique().sortBy((n) => parseInt(n, 10)).value();

  const lowerBound = keys[Math.floor(keys.length / 5)];
  const upperBound = keys[keys.length - Math.floor(keys.length / 5)];

  let count;

  const expectedResult = bplustree.fetchRange(lowerBound, upperBound).length;

  suite.add({
    name: 'bplus-index',
    fn: () => {
      count = bplusindex.getRange(lowerBound, upperBound, { upperInclusive: true }).length;
    },
    teardown: () => {
      assert(count, expectedResult, 'bplus-index range error', _.isEqual);
    },
  });

  suite.add({
    name: 'bplustree',
    fn: () => {
      count = bplustree.fetchRange(lowerBound, upperBound).length;
    },
    teardown: () => {
      assert(count, expectedResult, 'bplustree range error', _.isEqual);
    },
  });

  suite.add({
    name: 'sorted-map',
    fn: () => {
      count = sortedMap.range(lowerBound, upperBound).length;
    },
    teardown: () => {
      // assert(count, count, 'sorted-map is unique!', _.isEqual);
    },
  });

  suite.add({
    name: 'array',
    fn: () => {
      count = _.filter(array, (x) => x.age >= lowerBound && x.age <= upperBound).length;
    },
    teardown: () => {
      assert(count, expectedResult, 'array range error', _.isEqual);
    },
  });

  suite.on('error', (event) => {
    throw new Error(event.target.error);
  });

  suite.on('complete', () => {
    suite.forEach((obj) => { results.push(obj.hz); });
    l.logt(compileResult(results));
    done();
  });

  suite.run();
};

const remove = (done) => {
  l.log('Testing remove(key, value)');

  const suite = new Benchmark.Suite();
  const results = [];
  let ds;
  const randRecs = _.shuffle(db);

  const numberToRemove = 50;

  let expected;
  let expectedUnique;

  ds = new BPlusTree({ order: bf });
  for (const rec of db) {
    ds.store(rec.age, rec.name);
  }
  for (let i = 0; i < numberToRemove; i++) {
    expected = ds.remove(randRecs[i].age, randRecs[i].name);
  }
  const expectedResult = dbSize - numberToRemove;

  suite.add({
    name: 'bplus-index',
    setup: () => {
      ds = new BPlusIndex({ debug: false, branchingFactor: bf });
      for (const rec of db) {
        ds.inject(rec.age, rec.name);
      }
    },
    fn: () => {
      for (let i = 0; i < numberToRemove; i++) {
        ds.eject(randRecs[i].age, randRecs[i].name);
      }
    },
    teardown: () => {
      expected = ds.getAll({ sortDescending: false }).length;
      assert(expected, expectedResult, 'bplus-index remove error', _.isEqual);
    },
  });

  suite.add({
    name: 'bplustree',
    setup: () => {
      ds = new BPlusTree({ order: bf });
      for (const rec of db) {
        ds.store(rec.age, rec.name);
      }
    },
    fn: () => {
      for (let i = 0; i < numberToRemove; i++) {
        ds.remove(randRecs[i].age, randRecs[i].name);
      }
    },
    teardown: () => {
      expected = ds.repr({ getValues: true }).length;
      assert(expected, expectedResult, 'bplustree remove error', _.isEqual);
    },
  });

  suite.add({
    name: 'sorted-map',
    setup: () => {
      ds = new Set();
      for (const rec of db) {
        ds.set(rec.age, rec.name);
      }
      expectedUnique = ds.range(smallestValue, highestValue).length - _.unique(_.pluck(randRecs.slice(0, 50), 'age')).length;
    },
    fn: () => {
      for (let i = 0; i < numberToRemove; i++) {
        ds.del(randRecs[i].age);
      }
    },
    teardown: () => {
      expected = ds.range(smallestValue, highestValue).length;
      assert(expected, expectedUnique, 'sorted-map remove error', _.isEqual);
    },
  });

  suite.add({
    name: 'array',
    setup: () => {
      ds = [];
      for (const rec of db) {
        ds.push({ age: rec.age, name: rec.name });
      }
    },
    fn: () => {
      for (let i = 0; i < numberToRemove; i++) {
        _.remove(ds, { age: randRecs[i].age, name: randRecs[i].name });
      }
    },
    teardown: () => {
      expected = _.sortByOrder(ds, ['age'], ['asc']).map((o) => o.name).length;
      assert(expected, expectedResult, 'array remove error', _.isEqual);
    },
  });

  suite.on('error', (event) => {
    throw new Error(event.target.error);
  });

  suite.on('complete', () => {
    suite.forEach((obj) => { results.push(obj.hz); });
    l.logt(compileResult(results));
    l.logt(compileFinalResults());
    done();
  });

  suite.run();
};

async.series([
  insert,
  get,
  getAllValues,
  getRange,
  remove,
]);
