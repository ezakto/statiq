const moment = require('moment');
const { blocksPlugin, markedPlugin, ejsPlugin } = require('statiq/plugins');

module.exports = function(statiq) {
  statiq.config({
    context: {
      moment,
    },

    plugins: [
      blocksPlugin(),
      markedPlugin(),
      ejsPlugin(),
    ],
  });
};
