var ejs = require('ejs');
var marked = require('marked');
var moment = require('moment');

module.exports = function(statiq) {
  statiq.config({

    paths: {
      templates: 'templates',
      content: 'content',
      publish: 'public',
      assets: 'assets'
    },

    context: {
      moment: moment
    },

    defaultTemplate: 'index.html',

    contentParser: marked,

    templateParser: function(template, data) {
      return ejs.render(template, data, { filename: data.template });
    }

  });
};
