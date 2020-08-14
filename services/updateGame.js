/**
 * Updates game in db with passed properties and un-archivates it
 * Original passed game is change in the result
 */
module.exports = (game, properties) => {
  return game.update({ ...properties, archived: false });
};
