const { blocksPlugin, markedPlugin, ejsPlugin } = require('statiq/plugins');

module.exports = function(statiq) {
  statiq.config({
    publishPath: 'public',

    context: {
      sitename: 'Statiq',
      year: 2019
    },

    defaultTemplate: 'index.html',
    contentExtension: '.md',

    cwd: __dirname + '/examples',

    plugins: [
      blocksPlugin(),
      markedPlugin(),
      ejsPlugin(),
    ],
  });
};
