var ejs = require('ejs');
var marked = require('marked');
var readfile = require('fs').readFileSync;

module.exports = function(statiq) {
    statiq.config({

        paths: {
            templates: 'templates',
            sources: 'sources',
            distribution: 'dist'
        },

        globals: {
            sitename: "Statiq",
            year: 2014
        },

        defaultTemplate: "index.html",

        cwd: "examples",

        contentParser: marked,

        templateParser: function(file, data) {
            return ejs.render(readfile(file, { encoding: 'utf8' }), data, {
                filename: data.template
            });
        }

    });
};