# js-index-data-structures

This project is a benchmark of several data structures implementations suitable for data indexing.

The goal is to find a suitable data structure to index non-unique fields of JavaScript objects.

# Data structures

Currently, the following data structures implementations are being benchmarked:

- B+ tree
  + [bplus-index](https://github.com/internalfx/bplus-index/)
  + [bplustree](https://github.com/vhf/bplustree)
- Sorted map / Skip list
  + [sorted-map](https://www.npmjs.com/package/sorted-map) (This lib does not allow several values per key, so the benchmark is very biased towards sorted-map having the best perfs.)
- JavaScript Array
  + [lodash](https://lodash.com)

In the future, I'm planning to evaluate other options such as:

- lodash's `_.indexBy`
- Splay Tree
- Red-black Tree
- Binary search tree

I might also fork sorted-map to have it handle non-unique keys.


# Expected API

Every data structure `ds` should implement the following:
- insertion function, e.g. `ds.insert(key, value) => *`
- retrieval of a value stored at `key`, e.g. `ds.get(key, value) => Value`
- retrieval of all stored values ordered by `key` (ascending), e.g. `ds.getAllValues() => [Values]`
- retrieval of all stored values whose keys are in a range `(lowerBound, upperBound)`, e.g. `ds.getRange(lowerBound, upperBound) => [Values]`
- removal of a value stored at `key`, e.g. `ds.remove(key, value) => Value`

# The benchmark

We first create a database `db` holding `dbSize` objects

```
obj = {
  age: random age between 0 and 90
  name: random name
};
```

For each data structure, we insert these objects using `age` as index and `name` as value.

In the future, I will probably add a configurable way of choosing the type of the indexed key and value. Indexing data on an integer between 0 and 90 is not very relevant. Using (somewhat) random timestamps (Number), dates (Date) or strings (String) as index might be more realistic.

# Usage

```shell
$ git clone git@github.com:vhf/js-index-data-structures.git
$ cd js-index-data-structures && npm install
```

You can adjust the database size `dbSize` and the branching factor of the B+ trees `bf` in `index.js`.

Run the benchmark using `$ npm run run`

Sample output:

```
Creating database of 500 records
Testing inject(key, value)
bplus-index     3763.50  ops/sec
bplustree       7494.82  ops/sec
sorted-map (u)  1953.81  ops/sec
array           5397.66  ops/sec

bplustree          1.39  x faster than  array
array              1.43  x faster than  bplus-index
bplus-index        1.93  x faster than  sorted-map (u)

Testing get(key)
bplus-index      211475.94  ops/sec
bplustree        116861.14  ops/sec
sorted-map (u)  2613862.12  ops/sec
array              1888.02  ops/sec

sorted-map (u)       12.36  x faster than  bplus-index  (fast)
bplus-index           1.81  x faster than  bplustree
bplustree            61.90  x faster than  array        (ultra slow)

Testing get all values
bplus-index      27072.04  ops/sec
bplustree       240871.37  ops/sec
sorted-map (u)  977338.08  ops/sec
array             3641.37  ops/sec

sorted-map (u)       4.06  x faster than  bplustree
bplustree            8.90  x faster than  bplus-index
bplus-index          7.43  x faster than  array

Testing getRange(lowerBound, upperBound)
bplus-index       54500.71  ops/sec
bplustree        253738.41  ops/sec
sorted-map (u)  1456061.81  ops/sec
array            104554.66  ops/sec

sorted-map (u)        5.74  x faster than  bplustree
bplustree             2.43  x faster than  array
array                 1.92  x faster than  bplus-index

Testing remove(key, value)
bplus-index      127284.47  ops/sec
bplustree         69245.34  ops/sec
sorted-map (u)  2624412.65  ops/sec
array               684.78  ops/sec

sorted-map (u)       20.62  x faster than  bplus-index  (fast)
bplus-index           1.84  x faster than  bplustree
bplustree           101.12  x faster than  array        (ultra slow)

Final results:
                        i  g  a  r  e
  1.00  sorted-map (u)  4  1  1  1  1
  9.07  bplustree       1  3  2  2  3
 12.48  bplus-index     3  2  3  4  2
701.97  array           2  4  4  3  4
```
