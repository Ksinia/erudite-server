const lettersQuantity = [
  "*-2",
  "e-12",
  "a-9",
  "i-9",
  "o-8",
  "n-6",
  "r-6",
  "t-6",
  "l-4",
  "s-4",
  "u-4",
  "d-4",
  "g-3",
  "b-2",
  "c-2",
  "m-2",
  "p-2",
  "f-2",
  "h-2",
  "v-2",
  "w-2",
  "y-2",
  "k-1",
  "j-1",
  "x-1",
  "q-1",
  "z-1",
];

const values = {
  "*": 0,
  e: 1,
  a: 1,
  i: 1,
  o: 1,
  n: 1,
  r: 1,
  t: 1,
  l: 1,
  s: 1,
  u: 1,
  d: 2,
  g: 2,
  b: 3,
  c: 3,
  m: 3,
  p: 3,
  f: 4,
  h: 4,
  v: 4,
  w: 4,
  y: 4,
  k: 5,
  j: 8,
  x: 8,
  q: 10,
  z: 10,
};

function createLetterArray(qty) {
  const qtyArray = qty.split("-");
  return Array(parseInt(qtyArray[1])).fill(qtyArray[0]);
}
const letters = lettersQuantity.reduce((acc, char) => {
  return acc.concat(createLetterArray(char));
}, []);

module.exports = { letters, values };
