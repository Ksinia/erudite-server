/**
 * Updates game in db with passed properties and un-archives it
 * Original passed game is change in the result
 */
export default (game, properties) => {
  return game.update({ ...properties, archived: false });
};
