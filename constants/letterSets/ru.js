const lettersQuantity = [
  "*-3",
  "а-10",
  "б-3",
  "в-5",
  "г-3",
  "д-5",
  "е-9",
  "ж-2",
  "з-2",
  "и-8",
  "й-4",
  "к-6",
  "л-4",
  "м-5",
  "н-8",
  "о-10",
  "п-6",
  "р-6",
  "с-6",
  "т-5",
  "у-3",
  "ф-1",
  "х-2",
  "ц-1",
  "ч-2",
  "ш-1",
  "щ-1",
  "ъ-1",
  "ы-2",
  "ь-2",
  "э-1",
  "ю-1",
  "я-3",
];

const values = {
  "*": 0,
  а: 1,
  б: 3,
  в: 2,
  г: 3,
  д: 2,
  е: 1,
  ж: 5,
  з: 5,
  и: 1,
  й: 2,
  к: 2,
  л: 2,
  м: 2,
  н: 1,
  о: 1,
  п: 2,
  р: 2,
  с: 2,
  т: 2,
  у: 3,
  ф: 10,
  х: 5,
  ц: 10,
  ч: 5,
  ш: 10,
  щ: 10,
  ъ: 10,
  ы: 5,
  ь: 5,
  э: 10,
  ю: 10,
  я: 3,
};

function createLetterArray(qty) {
  const qtyArray = qty.split("-");
  return Array(parseInt(qtyArray[1])).fill(qtyArray[0]);
}

const letters = lettersQuantity.reduce((acc, char) => {
  return acc.concat(createLetterArray(char));
}, []);

export default { letters, values };
