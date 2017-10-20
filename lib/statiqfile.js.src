var ejs = require('ejs');
var marked = require('marked');
var readfile = require('fs').readFileSync;

module.exports = function(statiq) {
    statiq.config({

        paths: {
            templates: 'tpl',
            sources: 'src',
            distribution: 'dst'
        },

        globals: {
        },

        defaultTemplate: 'index.html',

        contentParser: marked,

        templateParser: function(path, data) {
            return ejs.render(readfile(path, 'utf8'), data, {
                filename: data.template
            });
        }

    });
};