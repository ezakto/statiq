const ejs = require('ejs');
const marked = require('marked');

module.exports = function(statiq) {
  statiq.config({

    paths: {
      templates: 'templates',
      content: 'content',
      publish: 'public',
      assets: 'assets'
    },

    context: {
      sitename: 'Statiq',
      year: 2019
    },

    defaultTemplate: 'index.html',

    cwd: __dirname + '/examples',

    contentParser: marked,

    templateParser: function(template, document) {
      return ejs.render(template, Object.assign({}, document.context, {
        content: document.content,
      }), {
        filename: document.templatePath,
      });
    },

  });
};
