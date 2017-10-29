var ejs = require('ejs');
var marked = require('marked');
var moment = require('moment');

module.exports = function(statiq) {
  statiq.config({

    paths: {
      templates: 'tpl',
      sources: 'src',
      distribution: 'dst'
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
