const ejs = require('ejs');
const marked = require('marked');

module.exports = function(statiq) {
  statiq.config({

    paths: {
      templates: 'templates',
      content: 'content',
      publish: 'public'
    },

    context: {
      sitename: 'Statiq',
      year: 2017
    },

    defaultTemplate: 'index.html',

    cwd: __dirname + '/examples',

    contentParser: marked,

    templateParser: function(template, data) {
      return ejs.render(template, data, { filename: data.template });
    }

  });
};
