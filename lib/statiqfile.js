var ejs = require('ejs');
var marked = require('marked');
var moment = require('moment');

module.exports = function(statiq) {
  statiq.config({
    context: {
      moment: moment
    },

    defaultTemplate: 'index.html',

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