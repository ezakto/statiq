var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    Promise = require('promise');

var Statiq = function() {
    this._index = [];
    this._config = {
        paths: {
            templates: 'tpl',
            sources: 'src',
            distribution: 'dst'
        },
        defaultTemplate: "index.html",
        srcExt: ".md",
        dstExt: ".html",
        cwd: false,
        localsRegex: /^(\{[\s\S]*?\});/,
        sectionsRegex: /^<<([a-z0-9]+)\n([\s\S]+)\n\1;$/gm,
        contentParser: function(a) { return a },
        globals: {}
    };
};

Statiq.prototype.config = function(options) {
    this._config = _.extend(this._config, options);
};

Statiq.prototype.index = function() {
    var index = this._index;
    var config = this._config;
    var cwd = config.cwd ? path.resolve(config.cwd) : process.cwd();
    var srcPath = path.join(cwd, config.paths.sources);

    (function readdir(dir) {
        var stat = fs.statSync(dir);
        if (stat.isDirectory()) {
            fs.readdirSync(dir).forEach(function(elem){
                readdir(path.join(dir, elem));
            });
        } else if (stat.isFile() && path.extname(dir) === config.srcExt) {
            var src = fs.readFileSync(dir, { encoding: 'utf8' });
            var document, locals, sections = {};

            try {
                locals = JSON.parse(src.match(config.localsRegex)[1]);
                src = src.replace(config.localsRegex, '').replace(/^\s+|\s+$/g, '');
            } catch (e) {
                locals = {};
            }

            document = src.replace(config.sectionsRegex, function(match, id, content){
                sections[id] = config.contentParser(content);
                return content;
            });

            index.push({
                srcFile: path.relative(srcPath, dir),
                dstFile: path.relative(srcPath, dir).replace(new RegExp(config.srcExt + '$'), (locals.dstExt || config.dstExt)), 
                src: src,
                locals: locals,
                sections: sections,
                document: config.contentParser(document)
            });
        }
    })(srcPath);

    return this;
};

Statiq.prototype.parse = function() {
    var index = this._index;
    var config = this._config;
    var cwd = config.cwd ? path.resolve(config.cwd) : process.cwd();
    var tplPath = path.join(cwd, config.paths.templates);
    var dstPath = path.join(cwd, config.paths.distribution);
    
    index.forEach(function(file){
        var hash = _.extend({ document: file.document }, config.globals, file.locals, file.sections),
            targetDir = path.dirname(file.dstFile);

        hash.template = path.join(tplPath, hash.template || config.defaultTemplate);
        hash.root = path.relative(path.join(dstPath, targetDir), dstPath) || '.';
        hash.index = {};

        index.forEach(function(f){
            var dir = path.dirname(f.dstFile);
            !hash.index[dir] && (hash.index[dir] = []);
            hash.index[dir].push(_.extend({}, f.locals, {
                path: path.relative(targetDir, f.dstFile)
            }));
        });

        Promise.resolve(config.templateParser(hash.template, hash))
            .done(function(result){
                mkdirp(path.join(dstPath, targetDir), function(err){
                    !err && fs.writeFile(path.join(dstPath, file.dstFile), result, function(err){
                        !err && console.log('\u2713 ' + file.dstFile);
                    });
                });
            });

    });
};

module.exports = new Statiq();
module.exports.Constructor = Statiq;